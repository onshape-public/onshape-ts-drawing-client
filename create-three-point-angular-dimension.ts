import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2 } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, convertPointViewToPaper, getMidPoint, areParallelEdges } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
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
  try {
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);

    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;

      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        // Want 3 distinct points for center, point1 and point2
        if (edge.type === 'line') {
          if (point1 === null) {
            point1 = edge.data.start;
            point2 = edge.data.end;
            point1UniqueId = edge.uniqueId;
            point2UniqueId = edge.uniqueId; 
          } else if (centerPoint === null) {
            centerPoint = getMidPoint(edge.data.start, edge.data.end);
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
  } catch (error) {
    console.error(error);
    LOG.error('Create three point angular dimension failed in retrieve view and line edges.', error);
  }

  if (viewToUse != null && point1 !== null && centerPoint !== null) {
    /**
     * Modify the drawing to create a dimension
     */
    try {
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
        description: "Add angular dim",
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: 'Onshape::Dimension::ThreePointAngular',
              threePointAngularDimension: {
                arcPoint: {
                  coordinate: arcPoint,
                  type: 'Onshape::Reference::Point',
                },
                center: {
                  coordinate: centerPoint,
                  uniqueId: centerPointUniqueId,
                  viewId: viewToUse.viewId,
                  type: 'Onshape::Reference::Point',
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
                  coordinate: point1,
                  uniqueId: point1UniqueId,
                  viewId: viewToUse.viewId,
                  type: 'Onshape::Reference::Point',
                },
                point2: {
                  coordinate: point2,
                  uniqueId: point2UniqueId,
                  viewId: viewToUse.viewId,
                  type: 'Onshape::Reference::Point',
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
    } catch (error) {
      console.error(error);
      LOG.error('Create dimension failed in modify API call', error);
    }
  } else {
    console.log('Insufficient view and edge information to create the dimension.');
    LOG.error('Create dimension failed due to insufficient view and edge information.');
  }

} catch (error) {
  usage('create-three-point-angular-dimension');
  console.error(error);
  LOG.error('Create line to line linear dimension failed', error);
}
