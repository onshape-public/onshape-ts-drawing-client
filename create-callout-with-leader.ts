import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, Edge, GetDrawingJsonExportResponse, GetViewJsonGeometryResponse, View2, SnapPointType, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, convertPointViewToPaper } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData } from './utils/drawingutils.js';

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
  usage('create-callout-with-leader');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    const textHeight = 0.12;
    const annotationText = 'Callout';
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    var leaderLocation: number[] = null;
    var leaderSnapPointType: SnapPointType = null;
    var leaderEdgeId: string = null;
    var leaderViewId: string = null;
    var calloutLocation: number[] = null;

    /**
     * Retrieve a drawing view and some of its edges to get enough information to create the callout with leader
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);

    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
  
      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        if (edge.type === 'line') {
          // Locate leader at midpoint of edge
          leaderLocation = [
            (edge.data.start[0] + edge.data.end[0]) / 2.0,
            (edge.data.start[1] + edge.data.end[1]) / 2.0,
            (edge.data.start[2] + edge.data.end[2]) / 2.0
          ];
          leaderSnapPointType = SnapPointType.ModeMid;

          var calloutLocationInViewSpace = leaderLocation;
          calloutLocation = convertPointViewToPaper(calloutLocationInViewSpace, viewToUse.viewToPaperMatrix.items);

          // Separate callout from leader slightly
          calloutLocation[0] -= 2.0;
          calloutLocation[1] -= 2.0;

          leaderEdgeId = edge.uniqueId;
          leaderViewId = viewToUse.viewId;
          break;
        }
      }
    }
      
    if (viewToUse != null && leaderLocation !== null && leaderEdgeId !== null && leaderViewId !== null) {

      const requestBody = {
        description: 'Add callout',
        jsonRequests: [
          {
            messageName: 'onshapeCreateAnnotations',
            formatVersion: '2021-01-01',
            annotations: [
              {
                type: DrawingObjectType.CALLOUT,
                callout: {
                  borderShape: 'Circle',
                  borderSize: 0,
                  contents: annotationText,
                  contentsBottom: 'bottom',
                  contentsLeft: 'left',
                  contentsRight: 'right',
                  contentsTop: 'top',
                  leaderPosition: {
                    type: 'Onshape::Reference::Point',
                    coordinate: leaderLocation,
                    uniqueId: leaderEdgeId,
                    viewId: leaderViewId,
                    snapPointType: leaderSnapPointType
                  },
                  position: {
                    type: 'Onshape::Reference::Point',
                    coordinate: calloutLocation
                  },
                  textHeight: textHeight
                }
              }
            ]
          }
        ]
      };

      /**
       * Modify the drawing to create a callout with leader
       */
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;

      const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (responseOutput) {
        // Only 1 request was made - verify it succeeded
        if (responseOutput.results.length == 1 &&
            responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
          // Success - logicalId of new callout is available
          const newLogicalId = responseOutput.results[0].logicalId;
          console.log(`Create callout with leader succeeded and has a logicalId: ${newLogicalId}`);
        } else {
          console.log(`Create callout with leader failed. Response status code: ${responseOutput.statusCode}.`)
        }
      } else {
        console.log('Create callout with leader failed waiting for modify to finish.');
        LOG.info('Create callout with leader failed waiting for modify to finish.');
      }
    } else {
      console.log('Insufficient view and edge information to create the callout with leader.');
      LOG.error('Create callout with leader failed due to insufficient view and edge information.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create callout with leader failed.', error);
  }
}