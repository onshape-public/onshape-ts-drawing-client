import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse, View2 } from './utils/onshapetypes.js';
import { usage, ModifyJob, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation } from './utils/drawingutils.js';
import { getRandomViewOnActiveSheet, isArcAxisPerpendicularToViewPlane, convertPointViewToPaper, midPointOfArc } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
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
  try {
    viewToUse = await getRandomViewOnActiveSheet(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as View2;

    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
      LOG.info('Retrieval of view json geometry returned', retrieveViewJsonGeometryResponse);

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
  } catch (error) {
    console.error(error);
    LOG.error('Create radial dimension failed in retrieve view and circular arc edge.', error);
  }

  if (viewToUse != null && centerPoint !== null && chordPoint !== null && centerPointEdgeUniqueId !== null && chordPointEdgeUniqueId !== null) {
    /**
     * Modify the drawing to create a radial dimension
     */
    try {
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
        description: "Add radial dim",
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: [
            {
              type: 'Onshape::Dimension::Radial',
              radialDimension: {
                centerPoint: {
                  coordinate: centerPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: centerPointEdgeUniqueId,
                  viewId: viewToUse.viewId
                },
                chordPoint: {
                  coordinate: chordPoint,
                  type: 'Onshape::Reference::Point',
                  uniqueId: chordPointEdgeUniqueId,
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

      LOG.info('Initiated creation of radial dimension in drawing', modifyRequest);
      let jobStatus: ModifyJob = { requestState: 'ACTIVE', id: '' };
      const end = timeSpan();
      while (jobStatus.requestState === 'ACTIVE') {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const elapsedSeconds = end.seconds();

        // If modify takes over 1 minute, then log and continue
        if (elapsedSeconds > 60) {
          LOG.error(`Radial dimension creation timed out after ${elapsedSeconds} seconds`);
          break;
        }

        LOG.debug(`Waited for modify seconds=${elapsedSeconds}`);
        jobStatus = await apiClient.get(`api/drawings/modify/status/${modifyRequest.id}`) as ModifyJob;
      }

      LOG.info(`Created radial dimension`);
    } catch (error) {
      console.error(error);
      LOG.error('Create radial dimension failed in modify API call', error);
    }
  } else {
    console.log('Insufficient view and edge information to create the radial dimension.');
    LOG.error('Create radial dimension failed due to insufficient view and edge information.');
  }

} catch (error) {
  usage('create-radial-dimension');
  console.error(error);
  LOG.error('Create radial dimension failed', error);
}
