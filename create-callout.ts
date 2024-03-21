import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode } from './utils/onshapetypes.js';
import { usage, ModifyJob, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const randomLocation: number[] = getRandomLocation();
  const textHeight = 0.12;
  const annotationText = "Note at x: " + randomLocation[0] + "y: " + randomLocation[1];
  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);

  /**
   * Modify the drawing to create a callout
   */
  try {
    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
      description: "Add a callout to drawing",
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

    LOG.info('Initiated creation of callout in drawing', modifyRequest);
    let jobStatus: ModifyJob = { requestState: 'ACTIVE', id: '' };
    const end = timeSpan();
    while (jobStatus.requestState === 'ACTIVE') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const elapsedSeconds = end.seconds();

      // If modify takes over 1 minute, then log and continue
      if (elapsedSeconds > 60) {
        LOG.error(`Callout creation timed out after ${elapsedSeconds} seconds`);
        break;
      }

      LOG.debug(`Waited for modify seconds=${elapsedSeconds}`);
      jobStatus = await apiClient.get(`api/drawings/modify/status/${modifyRequest.id}`) as ModifyJob;
    }

    LOG.info(`Created ${annotationText}`);

  } catch (error) {
    console.error(error);
    LOG.error('Create callout failed', error);
  }

} catch (error) {
  usage('create-callout');
  console.error(error);
  LOG.error('Create callout failed', error);
}