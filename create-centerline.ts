import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse } from './utils/onshapetypes.js';
import { usage, ModifyJob, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation, getIdOfRandomViewOnActiveSheet } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  let viewId: string = null;
  let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
  let startPoint: number[] = null;
  let endPoint: number[] = null;
  let startPointEdgeUniqueId: string = null;
  let endPointEdgeUniqueId: string = null;

  /**
   * Retrieve a drawing view and some of its edges to get enough information to create the centerline
   */
  try {
    viewId = await getIdOfRandomViewOnActiveSheet(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as string;

    if (viewId !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
      LOG.info('Retrieval of view json geometry returned', retrieveViewJsonGeometryResponse);

      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        if (edge.type === 'line') {
          if (startPoint === null) {
            startPoint = edge.data.start;
            startPointEdgeUniqueId = edge.uniqueId;
          } else if (endPoint === null) {
            endPoint = edge.data.start;
            endPointEdgeUniqueId = edge.uniqueId;
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create centerline failed in retrieve view and edges calls.', error);
  }

  if (viewId != null && startPoint !== null && endPoint !== null && startPointEdgeUniqueId !== null && endPointEdgeUniqueId !== null) {
    /**
     * Modify the drawing to create a centerline
     */
    try {
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
        description: "Add a centerline to drawing",
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: 'Onshape::Centerline::PointToPoint',
              pointToPointCenterline: {
                point1: {
                  coordinate: startPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: startPointEdgeUniqueId,
                  viewId: viewId
                },
                point2: {
                  coordinate: endPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: endPointEdgeUniqueId,
                  viewId: viewId
                }
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

      LOG.info(`Created centerline`);
    } catch (error) {
      console.error(error);
      LOG.error('Create centerline failed in modify API call', error);
    }
  } else {
    console.log('Insufficient view and edge information to create the centerline.');
    LOG.error('Create centerline failed due to insufficient view and edge information.');
  }

} catch (error) {
  usage('create-centerline');
  console.error(error);
  LOG.error('Create centerline failed', error);
}
