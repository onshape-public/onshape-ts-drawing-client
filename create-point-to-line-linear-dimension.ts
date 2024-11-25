import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, Edge, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2, SnapPointType, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
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
  usage('create-point-to-line-linear-dimension');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    let point: number[] = null;
    let pointUniqueId: string = null;
    let pointSnapPointType: SnapPointType = null;
    let edgeStartPoint: number[] = null;
    let edgeUniqueId: string = null;
    let edgeSnapPointType: SnapPointType = null;
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
        if (point === null) {
          if (edge.type === 'line') {
            point = edge.data.start;
            pointUniqueId = edge.uniqueId;
            pointSnapPointType = SnapPointType.ModeStart;
          } else if (edge.type === 'circle') {
            point = edge.data.center;
            pointUniqueId = edge.uniqueId;
            pointSnapPointType = SnapPointType.ModeCenter;
          } else if (edge.type === 'circularArc') {
            point = edge.data.center;
            pointUniqueId = edge.uniqueId;
            pointSnapPointType = SnapPointType.ModeCenter;
          }
        } else if (edgeUniqueId === null && edge.type === 'line') {
          edgeStartPoint = edge.data.start;
          edgeUniqueId = edge.uniqueId;
          edgeSnapPointType = SnapPointType.ModeStart;
          break;
        }
      }
  
      if (point !== null && edgeUniqueId !== null) {
        // Put text location out from mid point by arbitrary amount
        textLocation = getMidPoint(point, edgeStartPoint);
        textLocation[0] += 0.03;
        textLocation = convertPointViewToPaper(textLocation, viewToUse.viewToPaperMatrix.items);
      }
    }
  
    if (viewToUse != null && point !== null && edgeUniqueId !== null) {

      const requestBody = {
        description: 'Add linear dim',
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: DrawingObjectType.DIMENSION_POINT_TO_LINE_LINEAR,
              pointToLineDimension: {
                point: {
                  coordinate: point,
                  type: 'Onshape::Reference::Point',
                  uniqueId: pointUniqueId,
                  viewId: viewToUse.viewId,
                  snapPointType: pointSnapPointType
                },
                edge: {
                  type: 'Onshape::Reference::Edge',
                  uniqueId: edgeUniqueId,
                  viewId: viewToUse.viewId,
                  snapPointType: edgeSnapPointType
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
    LOG.error('Create point to line linear dimension failed: ', error);
  }
}