import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode } from './utils/onshapetypes.js';
import { usage, ModifyJob, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const randomLocation: number[] = getRandomLocation([1.0, 1.0], [8.0, 8.0]);
  const geometricToleranceFrame1 = '{\\fDrawing Symbols Sans;◎}%%v{\\fDrawing Symbols Sans;∅}tol1{\\fDrawing Symbols Sans;Ⓜ}%%v%%v%%v%%v%%v\n';
  const geometricToleranceFrame2 = '{\\fDrawing Symbols Sans;⌖}%%vto2{\\fDrawing Symbols Sans;Ⓛ}%%v%%v%%v%%v%%v\n';
  const textHeight = 0.12;
  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);

  /**
   * Modify the drawing to create a callout
   */
  try {
    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
      description: "Add GTol",
      jsonRequests: [ {
        messageName: 'onshapeCreateAnnotations',
        formatVersion: '2021-01-01',
        annotations: [
          {
            type: 'Onshape::GeometricTolerance',
            geometricTolerance: {
              frames: [
                geometricToleranceFrame1,
                geometricToleranceFrame2
              ],
              position: {
                type: 'Onshape::Reference::Point',
                coordinate: randomLocation
              }
            }
          }
        ]
      }]
    }) as BasicNode;

    LOG.info('Initiated creation of geometric tolerance in drawing', modifyRequest);
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

    LOG.info(`Created geometric tolerance`);

  } catch (error) {
    console.error(error);
    LOG.error('Create geometric tolerance failed', error);
  }

} catch (error) {
  usage('create-geometric-tolerance');
  console.error(error);
  LOG.error('Create geometric tolerance failed', error);
}
