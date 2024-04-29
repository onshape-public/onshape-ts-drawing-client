import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetDrawingJsonExportResponse, GetViewJsonGeometryResponse, View2 } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getRandomLocation } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, isArcAxisPerpendicularToViewPlane, convertPointViewToPaper, pointOnCircle } from './utils/drawingutils.js';

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
  usage('create-diameter-dimension');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    let centerPoint: number[] = null;
    let chordPoint: number[] = null;
    let farChordPoint: number[] = null;
    let textLocation: number[] = null;
    let centerPointEdgeUniqueId: string = null;
    let chordPointEdgeUniqueId: string = null;
    let farChordPointEdgeUniqueId: string = null;
  
    /**
     * Retrieve a drawing view and some of its edges to get enough information to create the diameter dimension
     */
    try {
      let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
      viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);
    } catch (error) {
      console.error(error);
      LOG.error('Create diameter dimension failed: ', error);
    }
    
    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
  
      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        // Want circles with view axis perpendicular to view plane
        if (edge.type === 'circle' && isArcAxisPerpendicularToViewPlane(edge.data.axisDir)) {
          centerPoint = edge.data.center;
          centerPointEdgeUniqueId = edge.uniqueId;
          chordPoint = pointOnCircle(edge.data.center, edge.data.radius, 45.0);
          chordPointEdgeUniqueId = edge.uniqueId;
          farChordPoint = pointOnCircle(edge.data.center, edge.data.radius, 225.0);
          farChordPointEdgeUniqueId = edge.uniqueId;
  
          // Locate text out from chord point by a bit
          textLocation = [
            chordPoint[0] + (chordPoint[0] - centerPoint[0]),
            chordPoint[2],
            centerPoint[2]
          ];
          textLocation = convertPointViewToPaper(textLocation, viewToUse.viewToPaperMatrix.items);
          break;
        }
      }
    }
  
    if (viewToUse != null && centerPoint !== null && chordPoint !== null && centerPointEdgeUniqueId !== null && chordPointEdgeUniqueId !== null) {
      /**
       * Modify the drawing to create a radial dimension
       */
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
        description: "Add diameter dim",
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: 'Onshape::Dimension::Diametric',
              diametricDimension: {
                chordPoint: {
                  coordinate: chordPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: chordPointEdgeUniqueId,
                  viewId: viewToUse.viewId
                },
                farChordPoint: {
                  coordinate: farChordPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: farChordPointEdgeUniqueId,
                  viewId: viewToUse.viewId
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
    LOG.error('Create diameter dimension failed', error);
  }
}