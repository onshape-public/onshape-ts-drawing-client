import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, Edge, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2, SnapPointType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, convertPointViewToPaper, getMidPoint, areCoincidentPoints } from './utils/drawingutils.js';

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
  usage('create-three-point-angular-dimension');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    let point1: number[] = null;
    let point2: number[] = null;
    let centerPoint: number[] = null;
    let arcPoint: number[] = null;
    let point1UniqueId: string = null;
    let point2UniqueId: string = null;
    let centerPointUniqueId: string = null;
    let textLocation: number[] = null;
  
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
        // Want 3 distinct points for center, point1 and point2
        if (edge.type === 'line') {
          if (point1 === null && !areCoincidentPoints(edge.data.start, edge.data.end)) {
            point1 = edge.data.start;
            point2 = edge.data.end;
            point1UniqueId = edge.uniqueId;
            point2UniqueId = edge.uniqueId; 
          } else if (point1 !== null && centerPoint === null &&
                      !areCoincidentPoints(edge.data.start, edge.data.end) &&
                      !areCoincidentPoints(point1, edge.data.start) &&
                      !areCoincidentPoints(point1, edge.data.end) &&
                      !areCoincidentPoints(point2, edge.data.start) &&
                      !areCoincidentPoints(point2, edge.data.end)) {
            centerPoint = edge.data.start;
            centerPointUniqueId = edge.uniqueId;
          
            // Put text location on some mid point between point1 and point2
            textLocation = getMidPoint(point1, point2);
            textLocation = convertPointViewToPaper(textLocation, viewToUse.viewToPaperMatrix.items);

            // Make arc point offset from text position
            arcPoint = [
              textLocation[0] + 1.0,
              textLocation[1] + 1.0,
              textLocation[2]
            ];
            break;
          }
        }
      }
    }
  
    if (viewToUse != null && point1 !== null && centerPoint !== null) {

      const requestBody = {
        description: 'Add angular dim',
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: DrawingObjectType.DIMENSION_THREE_POINT_ANGULAR,
              threePointAngularDimension: {
                arcPoint: {
                  type: 'Onshape::Reference::Point',
                  coordinate: arcPoint
                },
                center: {
                  type: 'Onshape::Reference::Point',
                  coordinate: centerPoint,
                  uniqueId: centerPointUniqueId,
                  viewId: viewToUse.viewId,
                  snapPointType: SnapPointType.ModeStart
                },
                formatting: {
                  dimdec: 3,
                  dimlim: false,
                  dimpost: '',
                  dimtm: 0,
                  dimtol: false,
                  dimtp: 0,
                  type: 'Onshape::Formatting::Dimension'
                },
                point1: {
                  type: 'Onshape::Reference::Point',
                  coordinate: point1,
                  uniqueId: point1UniqueId,
                  viewId: viewToUse.viewId,
                  snapPointType: SnapPointType.ModeStart
                },
                point2: {
                  type: 'Onshape::Reference::Point',
                  coordinate: point2,
                  uniqueId: point2UniqueId,
                  viewId: viewToUse.viewId,
                  snapPointType: SnapPointType.ModeEnd
                },
                textOverride: '',
                textPosition: {
                  type: 'Onshape::Reference::Point',
                  coordinate: textLocation
                }
              }
            }
          ]
        }]
      };

      /**
       * Modify the drawing to create a dimension
       */
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;
  
      const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (responseOutput) {
        // Only 1 request was made - verify it succeeded
        if (responseOutput.results.length == 1 &&
            responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
          // Success - logicalId of new dimension is available
          const newLogicalId = responseOutput.results[0].logicalId;
          console.log(`Create dimension succeeded and has a logicalId: ${newLogicalId}`);
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
    LOG.error('Create line to line linear dimension failed', error);
  }
}