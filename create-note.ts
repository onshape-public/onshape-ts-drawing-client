import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const randomLocation: number[] = getRandomLocation([1.0, 1.0], [8.0, 8.0]);
  const textHeight = 0.12;
  const annotationText = `Note at x: ${randomLocation[0]} y: ${randomLocation[1]}`;
  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);

  /**
   * Modify the drawing to create a note
   */
  const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
    description: "Add note",
    jsonRequests: [ {
      messageName: 'onshapeCreateAnnotations',
      formatVersion: '2021-01-01',
      annotations: [
        {
          type: 'Onshape::Note',
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
    }]
  }) as BasicNode;

  const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
  if (waitSucceeded) {
    console.log('Successfully created note.');
    LOG.info(`Successfully created note.`);
  } else {
    console.log('Create note failed waiting for modify to finish.');
    LOG.info('Create note failed waiting for modify to finish.');
  }
} catch (error) {
  usage('create-note');
  console.error(error);
  LOG.error('Create note failed', error);
}
