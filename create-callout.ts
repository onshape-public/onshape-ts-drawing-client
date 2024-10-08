import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType } from './utils/onshapetypes.js';
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
  
    const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (waitSucceeded) {
      console.log('Successfully created callout.');
      LOG.info(`Successfully created callout.`);
    } else {
      console.log('Create callout failed waiting for modify to finish.');
      LOG.info('Create callout failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create callout failed', error);
  }
}