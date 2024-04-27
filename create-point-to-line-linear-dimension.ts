import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2 } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, convertPointViewToPaper, getMidPoint } from './utils/drawingutils.js';

const LOG = mainLog();

let drawingScriptArgs: DrawingScriptArgs = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;

try {
  drawingScriptArgs = parseDrawingScriptArgs();
  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  if (apiClient.getBaseURL() !== drawingScriptArgs.baseURL) {
    console.log(`WARNING: Credentials base URL ${apiClient.getBaseURL()} does not match drawinguri base URL ${drawingScriptArgs.baseURL}.`);
  }
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
    let edgeStartPoint: number[] = null;
    let edgeUniqueId: string = null;
    let textLocation: number[] = null;
  
    /**
     * Retrieve a drawing view and some of its edges to get enough information to create the dimension
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
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
          } else if (edge.type === 'circle') {
            point = edge.data.center;
            pointUniqueId = edge.uniqueId;
          } else if (edge.type === 'circularArc') {
            point = edge.data.center;
            pointUniqueId = edge.uniqueId;
          }
        } else if (edgeUniqueId === null && edge.type === 'line') {
          edgeStartPoint = edge.data.start;
          edgeUniqueId = edge.uniqueId;
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
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
        description: "Add linear dim",
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: 'Onshape::Dimension::PointToLine',
              pointToLineDimension: {
                point: {
                  coordinate: point,
                  type: 'Onshape::Reference::Point',
                  uniqueId: pointUniqueId,
                  viewId: viewToUse.viewId
                },
                edge: {
                  type: 'Onshape::Reference::Edge',
                  uniqueId: edgeUniqueId,
                  viewId: viewToUse.viewId
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
      }) as BasicNode;
  
      const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (waitSucceeded) {
        console.log('Successfully created dimension.');
        LOG.info(`Successfully created dimension.`);
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