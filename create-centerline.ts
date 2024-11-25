import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, Edge, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2, SnapPointType, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData } from './utils/drawingutils.js';

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
  usage('create-centerline');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    let startPoint: number[] = null;
    let endPoint: number[] = null;
    let startPointEdgeUniqueId: string = null;
    let endPointEdgeUniqueId: string = null;
    let startSnapPointType: SnapPointType = null;
    let endSnapPointType: SnapPointType = null;
  
    /**
     * Retrieve a drawing view and some of its edges to get information to create the centerline
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);
    
    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
  
      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        if (edge.type === 'circle') {
          if (startPoint === null) {
            startPoint = edge.data.center;
            startPointEdgeUniqueId = edge.uniqueId;
            startSnapPointType = SnapPointType.ModeCenter;
          } else if (endPoint === null) {
            endPoint = edge.data.center;
            endPointEdgeUniqueId = edge.uniqueId;
            endSnapPointType = SnapPointType.ModeCenter;
            break;
          }
        }
      }
    }
  
    if (viewToUse.viewId != null && startPoint !== null && endPoint !== null && startPointEdgeUniqueId !== null && endPointEdgeUniqueId !== null) {

      const requestBody = {
        description: 'Add centerline',
        jsonRequests: [ 
          {
            messageName: 'onshapeCreateAnnotations',
            formatVersion: '2021-01-01',
            annotations: [
              {
                type: DrawingObjectType.CENTERLINE_POINT_TO_POINT,
                pointToPointCenterline: {
                  point1: {
                    coordinate: startPoint,
                    type: 'Onshape::Reference::Point',
                    uniqueId: startPointEdgeUniqueId,
                    viewId: viewToUse.viewId,
                    snapPointType: startSnapPointType
                  },
                  point2: {
                    coordinate: endPoint,
                    type: 'Onshape::Reference::Point',
                    uniqueId: endPointEdgeUniqueId,
                    viewId: viewToUse.viewId,
                    snapPointType: endSnapPointType
                  }
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
          // Success - logicalId of new centerline is available
          const newLogicalId = responseOutput.results[0].logicalId;
          console.log(`Create centerline succeeded and has a logicalId: ${newLogicalId}`);
        } else {
          console.log(`Create centerline failed. Response status code: ${responseOutput.statusCode}.`)
        }
      } else {
        console.log('Create centerline failed waiting for modify to finish.');
        LOG.info('Create centerline failed waiting for modify to finish.');
      }
    } else {
      console.log('Insufficient view and edge information to create the centerline.');
      LOG.error('Create centerline failed due to insufficient view and edge information.');
    }
  
  } catch (error) {
    console.error(error);
    LOG.error('Create centerline failed: ', error);
  }
}