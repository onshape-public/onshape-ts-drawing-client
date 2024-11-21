import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, Edge, GetDrawingJsonExportResponse, GetViewJsonGeometryResponse, SnapPointType, View2, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, isArcAxisPerpendicularToViewPlane, convertPointViewToPaper, midPointOfArc } from './utils/drawingutils.js';

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
  usage('create-radial-dimension');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    let centerPoint: number[] = null;
    let chordPoint: number[] = null;
    let textLocation: number[] = null;
    let centerPointEdgeUniqueId: string = null;
    let chordPointEdgeUniqueId: string = null;
  
    /**
     * Retrieve a drawing view and some of its edges to get enough information to create the radial dimension
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);
  
    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
  
      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        // Want circular arcs with view axis perpendicular to view plane
        if (edge.type === 'circularArc' && isArcAxisPerpendicularToViewPlane(edge.data.axisDir)) {
          centerPoint = edge.data.center;
          centerPointEdgeUniqueId = edge.uniqueId;
          chordPoint = midPointOfArc(edge.data.center, edge.data.radius, edge.data.start, edge.data.end);
          chordPointEdgeUniqueId = edge.uniqueId;
  
          // Put text out from chord point by the radius of edge in appropriate direction
          textLocation = chordPoint;
          textLocation[0] += (chordPoint[0] - centerPoint[0]);
          textLocation[1] += (chordPoint[1] - centerPoint[1]);
          textLocation = convertPointViewToPaper(textLocation, viewToUse.viewToPaperMatrix.items);
          break;
        }
      }
    }
  
    if (viewToUse != null && centerPoint !== null && chordPoint !== null && centerPointEdgeUniqueId !== null && chordPointEdgeUniqueId !== null) {

      const requestBody = {
        description: 'Add radial dim',
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: DrawingObjectType.DIMENSION_RADIAL,
              radialDimension: {
                centerPoint: {
                  coordinate: centerPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: centerPointEdgeUniqueId,
                  viewId: viewToUse.viewId,
                  snapPointType: SnapPointType.ModeCenter
                },
                chordPoint: {
                  coordinate: chordPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: chordPointEdgeUniqueId,
                  viewId: viewToUse.viewId,
                  snapPointType: SnapPointType.ModeNear
                },
                formatting: {
                  dimdec: 2,
                  dimlim: false,
                  dimpost: 'R<>',
                  dimtm: 0,
                  dimtol: false,
                  dimtp: 0,
                  type: 'Onshape::Formatting::Dimension'
                },
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

      /**
       * Modify the drawing to create a radial dimension
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
      console.log('Insufficient view and edge information to create the dimension. Maybe no circular arcs were found?');
      LOG.error('Create dimension failed due to insufficient view and edge information. Maybe no circular arcs were found?');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create radial dimension failed', error);
  }
}