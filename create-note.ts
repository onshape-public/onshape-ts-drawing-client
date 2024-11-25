import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getRandomLocation } from './utils/drawingutils.js';

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
  usage('create-note');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    const randomLocation: number[] = getRandomLocation([1.0, 1.0], [8.0, 8.0]);
    const textHeight = 0.12;
    const annotationText = `Note at x: ${randomLocation[0]} y: ${randomLocation[1]}`;

    const requestBody = {
      description: 'Add note',
      jsonRequests: [
        {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: DrawingObjectType.NOTE,
              note: {
                position: {
                  type: 'Onshape::Reference::Point',
                  coordinate: randomLocation
                },
                contents: annotationText,
                textHeight: textHeight
              }
            }
          ]
        }
      ]
    };

    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;
  
    const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (responseOutput) {
      // Only 1 request was made - verify it succeeded
      if (responseOutput.results.length == 1 &&
          responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
        // Success - logicalId of new note is available
        const newLogicalId = responseOutput.results[0].logicalId;
        console.log(`Create note succeeded and has a logicalId: ${newLogicalId}`);
      } else {
        console.log(`Create note failed. Response status code: ${responseOutput.statusCode}.`)
      }
    } else {
      console.log('Create note failed waiting for modify to finish.');
      LOG.info('Create note failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create note failed', error);
  }
}