import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingJsonExportResponse, GetViewJsonGeometryResponse, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getPartId, getDrawingJsonExport, convertPointViewToPaper } from './utils/drawingutils.js';
import { ArgumentParser } from './utils/argumentparser.js';

const LOG = mainLog();

const BASE_VIEW_LOGICAL_ID = 'viewSectionBase';
const SECTION_VIEW_LOGICAL_ID = 'viewSectionA';
const BASE_VIEW_POSITION = { x: 3, y: 6 };

let drawingScriptArgs: DrawingScriptArgs = null;
let viewReferencePartElementId: string = null;
let viewReferencePartName: string = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;
let partId: string = null;

try {
  drawingScriptArgs = parseDrawingScriptArgs();
  viewReferencePartElementId = ArgumentParser.get('partElementId');
  viewReferencePartName = ArgumentParser.get('partName');
  if (!viewReferencePartElementId || !viewReferencePartName) {
    console.error('--partElementId --partName argument is required');
    throw new Error('--partElementId --partName argument is required');
  }

  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  validateBaseURLs(apiClient.getBaseURL(), drawingScriptArgs.baseURL);

  partId = await getPartId(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, viewReferencePartElementId, viewReferencePartName);
  if (!partId) {
    console.error('Failed to find part');
    throw new Error('Failed to find part');
  }
} catch (error) {
  validArgs = false;
  usage('create-section-view');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

    /**
     * A section line's attachmentPoints must be associative (tied to a real edge via
     * deterministicId and viewId) - a plain floating coordinate is interpreted in sheet space,
     * not the view's model space, and fails server-side with "Could not download section view".
     * So the base (TopLevel) view is created and committed first. Its real viewId comes straight
     * back in the create response, which is then used to query its rendered geometry
     * (jsongeometry) for an edge endpoint to anchor the section line to.
     */
    const createBaseViewRequestBody = {
      description: 'Add base view',
      jsonRequests: [
        {
          messageName: 'onshapeCreateViews',
          formatVersion: '2021-01-01',
          views: [
            {
              viewType: 'TopLevel',
              position: BASE_VIEW_POSITION,
              scale: { scaleSource: 'Custom', numerator: 1, denumerator: 3 },
              orientation: 'front',
              reference: {
                elementId: viewReferencePartElementId,
                idTag: partId
              },
              logicalId: BASE_VIEW_LOGICAL_ID
            }
          ]
        }
      ]
    };

    const createBaseViewModifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, createBaseViewRequestBody) as BasicNode;
    const createBaseViewResponseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, createBaseViewModifyRequest.id);

    if (createBaseViewResponseOutput && createBaseViewResponseOutput.status == SingleRequestResultStatus.RequestSuccess &&
        createBaseViewResponseOutput.results.length == 1 && createBaseViewResponseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {

      // The create response returns the real, persisted viewId for the view that was just created
      const baseViewId: string = createBaseViewResponseOutput.results[0].viewId;
      let attachmentPointCoordinate: number[] = null;
      let attachmentPointDeterministicId: string = null;

      if (baseViewId) {
        LOG.info('Initiated retrieval of base view json geometry');
        const viewJsonGeometryResponse: GetViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${baseViewId}/jsongeometry`) as GetViewJsonGeometryResponse;

        // Anchor the section line to one endpoint of a real line edge in the view, so the
        // attachment point is associative (tied to actual geometry) rather than a floating coordinate
        for (const edge of viewJsonGeometryResponse.bodyData) {
          if (edge.type === 'line' && edge.data.start) {
            attachmentPointCoordinate = edge.data.start;
            attachmentPointDeterministicId = edge.deterministicId;
            break;
          }
        }
        if (!attachmentPointCoordinate) {
          // Fall back to a circular edge's center if no line edge was found - no second point
          // is available here, so joggedSectionLinePoints is left out in this case
          for (const edge of viewJsonGeometryResponse.bodyData) {
            if (edge.data.center) {
              attachmentPointCoordinate = edge.data.center;
              attachmentPointDeterministicId = edge.deterministicId;
              break;
            }
          }
        }
      }

      // joggedSectionLinePoints are plain (non-associative) points in paper/sheet space, unlike
      // attachmentPoints which are associative points in the view's local model space. Convert the
      // attachment point into paper space using the base view's viewToPaperMatrix, then place the
      // jog line's two points 1 unit above and below it along the paper-space y axis.
      let sectionLineStartPaperPoint: number[] = null;
      let sectionLineEndPaperPoint: number[] = null;

      if (baseViewId && attachmentPointCoordinate) {
        const drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId);
        if (drawingJsonExport) {
          for (const sheet of drawingJsonExport.sheets) {
            const matchingView = sheet.views.find((view) => view.viewId === baseViewId);
            if (matchingView) {
              const attachmentPaperPoint = convertPointViewToPaper(attachmentPointCoordinate, matchingView.viewToPaperMatrix.items);
              sectionLineStartPaperPoint = [attachmentPaperPoint[0], attachmentPaperPoint[1] - 1, attachmentPaperPoint[2]];
              sectionLineEndPaperPoint = [attachmentPaperPoint[0], attachmentPaperPoint[1] + 1, attachmentPaperPoint[2]];
              break;
            }
          }
        }
      }

      if (baseViewId && attachmentPointCoordinate && attachmentPointDeterministicId) {
        // The jogged section line's first and last points represent its start and end, in paper
        // (sheet) space - these are plain, non-associative points, unlike attachmentPoints
        const joggedSectionLinePoints = (sectionLineStartPaperPoint && sectionLineEndPaperPoint) ? [
          {
            type: 'Onshape::Reference::Point',
            coordinate: sectionLineStartPaperPoint
          },
          {
            type: 'Onshape::Reference::Point',
            coordinate: sectionLineEndPaperPoint
          }
        ] : undefined;

        const createSectionViewRequestBody = {
          description: 'Add section view',
          jsonRequests: [
            {
              messageName: 'onshapeCreateViews',
              formatVersion: '2021-01-01',
              views: [
                {
                  viewType: 'Section',
                  position: { x: 5, y: 6 },
                  orientation: 'right',
                  parentView: { logicalId: BASE_VIEW_LOGICAL_ID },
                  attachmentPoints: [
                    {
                      type: 'Onshape::Reference::Point',
                      coordinate: attachmentPointCoordinate,
                      deterministicId: attachmentPointDeterministicId,
                      viewId: baseViewId
                    }
                  ],
                  ...(joggedSectionLinePoints ? { joggedSectionLinePoints } : {}),
                  sectionType: 'Vertical',
                  viewDirection: 'Forward',
                  showViewLabel: true,
                  labelDefinition: { letter: 'A', prefix: 'SECTION' },
                  logicalId: SECTION_VIEW_LOGICAL_ID
                }
              ]
            }
          ]
        };

        console.log('Create section view request body:', JSON.stringify(createSectionViewRequestBody, null, 2));
        LOG.info('Create section view request body:', JSON.stringify(createSectionViewRequestBody));

        const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, createSectionViewRequestBody) as BasicNode;

        const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
        if (responseOutput) {
          if (responseOutput.status == SingleRequestResultStatus.RequestSuccess && responseOutput.results.length == 1) {
            if (responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
              const newLogicalId = responseOutput.results[0].logicalId;
              console.log(`Create section view succeeded and has a logicalId: ${newLogicalId}`);
            }
          } else {
            console.log(`Create section view failed. Response status code: ${responseOutput.statusCode}.`);
          }
        } else {
          console.log('Create section view failed waiting for modify to finish.');
          LOG.info('Create section view failed waiting for modify to finish.');
        }
      } else {
        console.log('Insufficient view and geometry information to create the section view.');
        LOG.error('Create section view failed due to insufficient view and geometry information.');
      }
    } else {
      console.log('Create base view for section view failed.');
      LOG.error('Create base view for section view failed.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create section view failed', error);
  }
}
