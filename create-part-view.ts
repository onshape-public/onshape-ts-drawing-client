import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getPartId, getRandomLocation } from './utils/drawingutils.js';
import { ArgumentParser } from './utils/argumentparser.js';

const LOG = mainLog();

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
    console.error("--partElementId --partName argument is required");
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
  usage('create-part-view');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

    const requestBody = {
      description: "Add views",
      jsonRequests: [
        {
          messageName: "onshapeCreateViews",
          formatVersion: "2021-01-01",
          views: [
            {
              "viewType": "TopLevel",
              "position": { "x": 2, "y": 6 },
              "scale": { "scaleSource": "Custom", "numerator": 1, "denumerator": 3 },
              "orientation": "front",
              "reference": {
                "elementId": viewReferencePartElementId,
                "idTag": partId
              },
              "logicalId": "viewFront"
            },
            {
              "viewType": "Projected",
              "position": { "x": 2, "y": 3 },
              "parentView": { "logicalId": "viewFront" },
              "name": "ChangedViewName",
              "showViewLabel": true,
              "logicalId": "viewRight"
            },
            {
              "viewType": "Projected",
              "position": { "x": 7, "y": 6 },
              "parentView": { "logicalId": "viewFront" },
              "showShadedView": true,
              "showCentermarks": false,
              "logicalId": "viewTop"
            },
            {
              "viewType": "Projected",
              "position": { "x": 7, "y": 3 },
              "parentView": { "logicalId": "viewFront" },
              "scale": { "scaleSource": "Custom", "numerator": 1, "denumerator": 3 },
              "showHiddenLines": true,
              "logicalId": "viewIsometric"
            }
          ]
        }
      ]
    };

    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;

    const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (responseOutput) {
      if (responseOutput.status == SingleRequestResultStatus.RequestSuccess && responseOutput.results.length == 4) {
        // Checking for viewFront only
        if (responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
          const newLogicalId = responseOutput.results[0].logicalId;
          console.log(`Create view succeeded and viewFront has a logicalId: ${newLogicalId}`);
        }
      } else {
        console.log(`Create view failed. Response status code: ${responseOutput.statusCode}.`)
      }
    } else {
      console.log('Create view failed waiting for modify to finish.');
      LOG.info('Create view failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create part view failed', error);
  }
}
