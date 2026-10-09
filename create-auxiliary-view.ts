import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetViewJsonGeometryResponse, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getPartId } from './utils/drawingutils.js';
import { ArgumentParser } from './utils/argumentparser.js';

const LOG = mainLog();

const BASE_VIEW_LOGICAL_ID = 'viewAuxiliaryBase';
const AUXILIARY_VIEW_LOGICAL_ID = 'viewAuxiliaryA';

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
  usage('create-auxiliary-view');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

    /**
     * An auxiliary view's referenceEntity must be an edge of an already-rendered view, so the base
     * view is created and committed first. Its real viewId comes straight back in the create
     * response, which is then used to query its rendered geometry (jsongeometry) for a linear
     * edge to reference before the auxiliary view itself is created.
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
              position: { x: 4, y: 6 },
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
      let referenceEdgeDeterministicId: string = null;

      if (baseViewId) {
        LOG.info('Initiated retrieval of base view json geometry');
        const viewJsonGeometryResponse: GetViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${baseViewId}/jsongeometry`) as GetViewJsonGeometryResponse;

        for (const edge of viewJsonGeometryResponse.bodyData) {
          // Normal auxiliary views need an edge that is linear in the parent-view projection
          if (edge.type === 'line') {
            referenceEdgeDeterministicId = edge.deterministicId;
            break;
          }
        }
      }

      if (baseViewId && referenceEdgeDeterministicId) {
        const createAuxiliaryViewRequestBody = {
          description: 'Add auxiliary view',
          jsonRequests: [
            {
              messageName: 'onshapeCreateViews',
              formatVersion: '2021-01-01',
              views: [
                {
                  viewType: 'Auxiliary',
                  position: { x: 9, y: 6 },
                  parentView: { logicalId: BASE_VIEW_LOGICAL_ID },
                  auxiliaryType: 'Normal',
                  referenceEntity: {
                    type: 'Onshape::Reference::Edge',
                    viewId: baseViewId,
                    deterministicId: referenceEdgeDeterministicId
                  },
                  showViewLabel: true,
                  showScaleLabel: true,
                  labelDefinition: { letter: 'A' },
                  logicalId: AUXILIARY_VIEW_LOGICAL_ID
                }
              ]
            }
          ]
        };

        console.log('Create auxiliary view request body:', JSON.stringify(createAuxiliaryViewRequestBody, null, 2));
        LOG.info('Create auxiliary view request body:', JSON.stringify(createAuxiliaryViewRequestBody));

        const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, createAuxiliaryViewRequestBody) as BasicNode;

        const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
        if (responseOutput) {
          if (responseOutput.status == SingleRequestResultStatus.RequestSuccess && responseOutput.results.length == 1) {
            if (responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
              const newLogicalId = responseOutput.results[0].logicalId;
              console.log(`Create auxiliary view succeeded and has a logicalId: ${newLogicalId}`);
            }
          } else {
            console.log(`Create auxiliary view failed. Response status code: ${responseOutput.statusCode}.`);
          }
        } else {
          console.log('Create auxiliary view failed waiting for modify to finish.');
          LOG.info('Create auxiliary view failed waiting for modify to finish.');
        }
      } else {
        console.log('Insufficient view and edge information to create the auxiliary view.');
        LOG.error('Create auxiliary view failed due to insufficient view and edge information.');
      }
    } else {
      console.log('Create base view for auxiliary view failed.');
      LOG.error('Create base view for auxiliary view failed.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create auxiliary view failed', error);
  }
}
