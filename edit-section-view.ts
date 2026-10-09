import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingJsonExportResponse, GetViewJsonGeometryResponse, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getDrawingJsonExport } from './utils/drawingutils.js';

const LOG = mainLog();

const SECTION_VIEW_LOGICAL_ID = 'viewSectionA';
const BASE_VIEW_POSITION = { x: 3, y: 6 };

let drawingScriptArgs: DrawingScriptArgs = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;

try {
  drawingScriptArgs = parseDrawingScriptArgs();
  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  validateBaseURLs(apiClient.getBaseURL(), drawingScriptArgs.baseURL);
} catch (error) {
  validArgs = false;
  usage('edit-section-view');
}

if (validArgs) {
  try {
    /**
     * attachmentPoints must be an associative point (tied to a real edge via deterministicId and
     * viewId). To pick a different attachment point than the one used at creation, the base view
     * is located (by its known sheet position) and its geometry is queried, skipping past the
     * first line edge so a different edge is used this time.
     */
    let baseViewId: string = null;
    let newAttachmentPointCoordinate: number[] = null;
    let newAttachmentPointDeterministicId: string = null;

    const drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId);
    if (drawingJsonExport) {
      for (const sheet of drawingJsonExport.sheets) {
        const matchingView = sheet.views.find((view) => view.position.x === BASE_VIEW_POSITION.x && view.position.y === BASE_VIEW_POSITION.y);
        if (matchingView) {
          baseViewId = matchingView.viewId;
          break;
        }
      }
    }

    if (baseViewId) {
      LOG.info('Initiated retrieval of base view json geometry');
      const viewJsonGeometryResponse: GetViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${baseViewId}/jsongeometry`) as GetViewJsonGeometryResponse;

      const lineEdges = viewJsonGeometryResponse.bodyData.filter((edge) => edge.type === 'line' && edge.data.start);
      // Skip the first line edge (used when the section view was created) to pick a different one
      const otherEdge = lineEdges.length > 1 ? lineEdges[1] : lineEdges[0];
      if (otherEdge) {
        newAttachmentPointCoordinate = otherEdge.data.start;
        newAttachmentPointDeterministicId = otherEdge.deterministicId;
      }
    }

    if (newAttachmentPointCoordinate && newAttachmentPointDeterministicId) {
      const requestBody = {
        description: 'Edit section view',
        jsonRequests: [
          {
            messageName: 'onshapeEditViews',
            formatVersion: '2021-01-01',
            views: [
              {
                logicalId: SECTION_VIEW_LOGICAL_ID,
                viewType: 'Section',
                name: 'edited section view',
                showViewLabel: true,
                attachmentPoints: [
                  {
                    type: 'Onshape::Reference::Point',
                    coordinate: newAttachmentPointCoordinate,
                    deterministicId: newAttachmentPointDeterministicId,
                    viewId: baseViewId
                  }
                ]
              }
            ]
          }
        ]
      };

      console.log('Edit section view request body:', JSON.stringify(requestBody, null, 2));
      LOG.info('Edit section view request body:', JSON.stringify(requestBody));

      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;

      const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (responseOutput) {
        if (responseOutput.status == SingleRequestResultStatus.RequestSuccess && responseOutput.results.length == 1) {
          if (responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
            console.log(`Edit section view succeeded for ${SECTION_VIEW_LOGICAL_ID}`);
          }
        } else {
          console.log(`Edit section view failed. Response status code: ${responseOutput.statusCode}.`);
        }
      } else {
        console.log('Edit section view failed waiting for modify to finish.');
        LOG.info('Edit section view failed waiting for modify to finish.');
      }
    } else {
      console.log('Insufficient view and edge information to edit the section view.');
      LOG.error('Edit section view failed due to insufficient view and edge information.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Edit section view failed', error);
  }
}
