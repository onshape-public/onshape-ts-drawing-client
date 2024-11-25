import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, DrawingScriptArgs, validateBaseURLs, waitForModifyToFinish, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';

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
  usage('create-callout');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    const randomLocation: number[] = getRandomLocation([1.0, 1.0], [8.0, 8.0]);
    const textHeight = 0.12;
    const annotationText = 'Callout';

    const requestBody = {
      description: 'Add callout',
      jsonRequests: [
        {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: DrawingObjectType.CALLOUT,
              callout: {
                borderShape: 'Circle',
                borderSize: 0,
                contents: annotationText,
                contentsBottom: 'bottom',
                contentsLeft: 'left',
                contentsRight: 'right',
                contentsTop: 'top',
                position: {
                  type: 'Onshape::Reference::Point',
                  coordinate: randomLocation
                },
                textHeight: textHeight
              }
            }
          ]
        }
      ]
    };
  
    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  requestBody) as BasicNode;
  
    const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (responseOutput) {
      // Only 1 request was made - verify it succeeded
      if (responseOutput.results.length == 1 &&
          responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
        // Success - logicalId of new callout is available
        const newLogicalId = responseOutput.results[0].logicalId;
        console.log(`Create callout succeeded and has a logicalId: ${newLogicalId}`);
      } else {
        console.log(`Create callout failed. Response status code: ${responseOutput.statusCode}.`)
      }
    } else {
      console.log('Create callout with leader failed waiting for modify to finish.');
      LOG.info('Create callout with leader failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create callout failed', error);
  }
}