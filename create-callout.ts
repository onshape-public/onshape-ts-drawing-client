import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode } from './utils/onshapetypes.js';
import { usage, DrawingScriptArgs, waitForModifyToFinish, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const randomLocation: number[] = getRandomLocation([1.0, 1.0], [8.0, 8.0]);
  const textHeight = 0.12;
  const annotationText = 'Callout';
  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);

  /**
   * Modify the drawing to create a callout
   */
  const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
    description: "Add callout",
    jsonRequests: [ {
      messageName: 'onshapeCreateAnnotations',
      formatVersion: '2021-01-01',
      annotations: [
        {
          type: 'Onshape::Callout',
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
    }]
  }) as BasicNode;

  const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
  if (waitSucceeded) {
    console.log('Successfully created callout.');
    LOG.info(`Successfully created callout.`);
  } else {
    console.log('Create callout failed waiting for modify to finish.');
    LOG.info('Create callout failed waiting for modify to finish.');
  }
} catch (error) {
  usage('create-callout');
  console.error(error);
  LOG.error('Create callout failed', error);
}
