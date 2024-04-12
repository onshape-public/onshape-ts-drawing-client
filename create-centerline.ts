import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2 } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation, getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  let viewToUse: View2 = null;
  let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
  let startPoint: number[] = null;
  let endPoint: number[] = null;
  let startPointEdgeUniqueId: string = null;
  let endPointEdgeUniqueId: string = null;

  /**
   * Retrieve a drawing view and some of its edges to get information to create the centerline
   */
  let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
  viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);
  
  if (viewToUse !== null) {
    LOG.info('Initiated retrieval of view json geometry');
    retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;

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

  if (viewToUse.viewId != null && startPoint !== null && endPoint !== null && startPointEdgeUniqueId !== null && endPointEdgeUniqueId !== null) {
    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
      description: "Add centerline",
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
                viewId: viewToUse.viewId
              },
              point2: {
                coordinate: endPoint,
                type: 'Onshape::Reference::Point',
                uniqueId: endPointEdgeUniqueId,
                viewId: viewToUse.viewId
              }
            }
          }
        ]
      }]
    }) as BasicNode;

    const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (waitSucceeded) {
      console.log('Successfully created centerline.');
      LOG.info(`Successfully created centerline.`);
    } else {
      console.log('Create centerline failed waiting for modify to finish.');
      LOG.info('Create centerline failed waiting for modify to finish.');
    }
  } else {
    console.log('Insufficient view and edge information to create the centerline.');
    LOG.error('Create centerline failed due to insufficient view and edge information.');
  }

} catch (error) {
  usage('create-centerline');
  console.error(error);
  LOG.error('Create centerline failed: ', error);
}
