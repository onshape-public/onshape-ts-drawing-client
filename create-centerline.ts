import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, GetViewJsonGeometryResponse } from './utils/onshapetypes.js';
import { usage, ModifyJob, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const randomLocation: number[] = getRandomLocation();
  const textHeight: number = 0.12;
  const annotationText: string = "Note at x: " + randomLocation[0] + "y: " + randomLocation[1];
  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);

  let retrieveViewsResponse: GetDrawingViewsResponse = null;
  let viewId: string = null;
  let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;

  /**
   * Retrieve a drawing view and some of its edges
   */
  try {
    LOG.info('Initiated retrieval of views in drawing');
    retrieveViewsResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/`) as GetDrawingViewsResponse;
    LOG.info('Retrieval of views in drawing returned', retrieveViewsResponse);

    console.log(`retrieveViewsResponse=${retrieveViewsResponse}`);

    if (retrieveViewsResponse.items.length < 1) {
      console.log('No views found in drawing.');
      viewId = null;
    } else {
      viewId = retrieveViewsResponse.items[0].viewId;
    }

    if (viewId != null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
      LOG.info('Retrieval of view json geometry returned', retrieveViewJsonGeometryResponse);

      console.log(`retrieveViewJsonGeometryResponse=${retrieveViewJsonGeometryResponse}`);

    }
  } catch (error) {
    console.error(error);
    LOG.error('Create centerline failed in retrieve view and edges calls', error);
  }

  if (viewId != null) {
    /**
     * Modify the drawing to create a centerline
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

      LOG.info('Initiated creation of centerline in drawing', modifyRequest);
      let jobStatus: ModifyJob = { requestState: 'ACTIVE', id: '' };
      const end = timeSpan();
      while (jobStatus.requestState === 'ACTIVE') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const elapsedSeconds = end.seconds();

        // If modify takes over 1 minute, then log and continue
        if (elapsedSeconds > 60) {
          LOG.error(`Centerline creation timed out after ${elapsedSeconds} seconds`);
          break;
        }

        LOG.debug(`Waited for modify seconds=${elapsedSeconds}`);
        jobStatus = await apiClient.get(`api/drawings/modify/status/${modifyRequest.id}`) as ModifyJob;
      }

      LOG.info(`Created ${annotationText}`);
    } catch (error) {
      console.error(error);
      LOG.error('Create centerline failed in modify API call', error);
    }
  }

} catch (error) {
  usage('create-centerline');
  console.error(error);
  LOG.error('Create centerline failed', error);
}
