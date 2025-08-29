import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';

const LOG = mainLog();

let drawingScriptArgs: DrawingScriptArgs = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;

try {
  drawingScriptArgs = parseDrawingScriptArgs();
  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  validateBaseURLs(apiClient.getBaseURL(), drawingScriptArgs.baseURL);
} catch (error) {
  validArgs = false;
  usage('edit-part-view');
}

if (validArgs) {
  try {
    const requestBody = {
      description: "Edit views",
      jsonRequests: [
        {
          messageName: "onshapeEditViews",
          formatVersion: "2021-01-01",
          views: [
            {
              "logicalId": "viewFront",
              "renderMode": "quality",
              "showCentermarks": true,
              "showShadedView": true
            },
            {
              "logicalId": "viewIsometric",
              "showHiddenLines": false,
              "position": { "x": 12, "y": 3 },
              "showViewLabel": true,
              "showScaleLabel": true
            }
          ]
        }
      ]
    };

    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;

    const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (responseOutput) {
      if (responseOutput.status == SingleRequestResultStatus.RequestSuccess && responseOutput.results.length == 2) {
        // Checking for viewFront only
        if (responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
          console.log('Edit view succeeded for viewFront');
        }
      } else {
        console.log(`Edit view failed. Response status code: ${responseOutput.statusCode}.`)
      }
    } else {
      console.log('Edit views failed waiting for modify to finish.');
      LOG.info('Edit views failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Edit part view failed', error);
  }
}
