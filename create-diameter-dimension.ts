import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetDrawingJsonExportResponse, GetViewJsonGeometryResponse, View2 } from './utils/onshapetypes.js';
import { usage, ModifyJob, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, isArcAxisPerpendicularToViewPlane, convertPointViewToPaper, pointOnCircle } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
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

    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
      LOG.info('Retrieval of view json geometry returned', retrieveViewJsonGeometryResponse);

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
  } catch (error) {
    console.error(error);
    LOG.error('Create diameter dimension failed in retrieve view and circle edge.', error);
  }

  if (viewToUse != null && centerPoint !== null && chordPoint !== null && centerPointEdgeUniqueId !== null && chordPointEdgeUniqueId !== null) {
    /**
     * Modify the drawing to create a radial dimension
     */
    try {
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

      LOG.info('Initiated creation of diameter dimension in drawing', modifyRequest);
      let jobStatus: ModifyJob = { requestState: 'ACTIVE', id: '' };
      const end = timeSpan();
      while (jobStatus.requestState === 'ACTIVE') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const elapsedSeconds = end.seconds();

        // If modify takes over 1 minute, then log and continue
        if (elapsedSeconds > 60) {
          LOG.error(`Diameter dimension creation timed out after ${elapsedSeconds} seconds`);
          break;
        }

        LOG.debug(`Waited for modify seconds=${elapsedSeconds}`);
        jobStatus = await apiClient.get(`api/drawings/modify/status/${modifyRequest.id}`) as ModifyJob;
      }

      LOG.info(`Created diameter dimension`);
    } catch (error) {
      console.error(error);
      LOG.error('Create diameter dimension failed in modify API call', error);
    }
  } else {
    console.log('Insufficient view and edge information to create the diameter dimension.');
    LOG.error('Create diameter dimension failed due to insufficient view and edge information.');
  }

} catch (error) {
  usage('create-diameter-dimension');
  console.error(error);
  LOG.error('Create diameter dimension failed', error);
}
