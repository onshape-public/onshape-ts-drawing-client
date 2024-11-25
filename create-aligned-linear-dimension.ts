import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, Edge, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2, DrawingObjectType, SnapPointType, ModifyStatusResponseOutput, SingleRequestResultStatus} from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, convertPointViewToPaper, getMidPoint } from './utils/drawingutils.js';

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
  usage('create-aligned-linear-dimension');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    let startPoint: number[] = null;
    let endPoint: number[] = null;
    let textLocation: number[] = null;
    let startPointEdgeUniqueId: string = null;
    let endPointEdgeUniqueId: string = null;
    let startSnapPointType: SnapPointType = null;
    let endSnapPointType: SnapPointType = null;
    let rotation: number = null;

    /**
     * Retrieve a drawing view and some of its edges to get enough information to create the dimension
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);
  
    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
  
      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        // Want line edge
        if (edge.type === 'line') {
          startPoint = edge.data.start;
          startPointEdgeUniqueId = edge.uniqueId;
          startSnapPointType = SnapPointType.ModeStart;
          endPoint = edge.data.end;
          endPointEdgeUniqueId = edge.uniqueId;
          endSnapPointType = SnapPointType.ModeEnd;
  
          // Put text location out from mid point by arbitrary amount
          textLocation = getMidPoint(startPoint, endPoint);
          textLocation[0] += 0.003;
          textLocation[1] += 0.003;
          textLocation = convertPointViewToPaper(textLocation, viewToUse.viewToPaperMatrix.items);

          // Set the alignment of the dimension to vertical
          rotation = 90.0;
          break;
        }
      }
    }
  
    if (viewToUse != null && startPoint !== null && endPoint !== null && startPointEdgeUniqueId !== null && endPointEdgeUniqueId !== null) {

      const requestBody = {
        description: 'Add linear dim',
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR,
              pointToPointDimension: {
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
                },
                formatting: {
                  dimdec: 2,
                  dimlim: false,
                  dimpost: '',
                  dimtm: 0,
                  dimtol: false,
                  dimtp: 0,
                  type: 'Onshape::Formatting::Dimension'
                },
                rotation: rotation,
                textOverride: '',
                textPosition: {
                  coordinate: textLocation,
                  type: 'Onshape::Reference::Point'
                }
              }
            }
          ]
        }]
      };

      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;
  
      const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (responseOutput) {
        // Only 1 request was made - verify it succeeded
        if (responseOutput.results.length == 1 &&
            responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
          // Success - logicalId of new dimension is available
          const newDimLogicalId = responseOutput.results[0].logicalId;
          console.log(`Create dimension succeeded and has a logicalId: ${newDimLogicalId}`);
        } else {
          console.log(`Create dimension failed. Response status code: ${responseOutput.statusCode}.`)
        }
      } else {
        console.log('Create dimension failed waiting for modify to finish.');
        LOG.info('Create dimension failed waiting for modify to finish.');
      }
    } else {
      console.log('Insufficient view and edge information to create the dimension.');
      LOG.error('Create dimension failed due to insufficient view and edge information.');
    }
  
  } catch (error) {
    console.error(error);
    LOG.error('Create aligned linear dimension failed: ', error);
  }
}