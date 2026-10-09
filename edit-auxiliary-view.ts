import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';

const LOG = mainLog();

const AUXILIARY_VIEW_LOGICAL_ID = 'viewAuxiliaryA';

let drawingScriptArgs: DrawingScriptArgs = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;

try {
  drawingScriptArgs = parseDrawingScriptArgs();
  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  validateBaseURLs(apiClient.getBaseURL(), drawingScriptArgs.baseURL);
} catch (error) {
  validArgs = false;
  usage('edit-auxiliary-view');
}

if (validArgs) {
  try {
    const requestBody = {
      description: 'Edit auxiliary view',
      jsonRequests: [
        {
          messageName: 'onshapeEditViews',
          formatVersion: '2021-01-01',
          views: [
            {
              logicalId: AUXILIARY_VIEW_LOGICAL_ID,
              viewType: 'Auxiliary',
              position: { x: 9, y: 3 },
              flipDirection: true,
              viewingLineLength: 0.05,
              showViewReferenceIndicator: false,
              showViewLabel: false,
              showScaleLabel: true
            }
          ]
        }
      ]
    };

    console.log('Edit auxiliary view request body:', JSON.stringify(requestBody, null, 2));
    LOG.info('Edit auxiliary view request body:', JSON.stringify(requestBody));

    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;

    const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (responseOutput) {
      if (responseOutput.status == SingleRequestResultStatus.RequestSuccess && responseOutput.results.length == 1) {
        if (responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
          console.log(`Edit auxiliary view succeeded for ${AUXILIARY_VIEW_LOGICAL_ID}`);
        }
      } else {
        console.log(`Edit auxiliary view failed. Response status code: ${responseOutput.statusCode}.`);
      }
    } else {
      console.log('Edit auxiliary view failed waiting for modify to finish.');
      LOG.info('Edit auxiliary view failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Edit auxiliary view failed', error);
  }
}
