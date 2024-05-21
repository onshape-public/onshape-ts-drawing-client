import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetDrawingJsonExportResponse, GetViewJsonGeometryResponse, View2 } from './utils/onshapetypes.js';
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
  usage('create-note-with-leader');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    const textHeight = 0.12;
    const annotationText = 'Note with leader';
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    var leaderLocation: number[] = null;
    var leaderEdgeId: string = null;
    var leaderViewId: string = null;
    var noteLocation: number[] = null;

    /**
     * Retrieve a drawing view and some of its edges to get enough information to create the note with leader
     */

    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);

    if (viewToUse !== null) {
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${viewToUse.viewId}/jsongeometry`) as GetViewJsonGeometryResponse;
  
      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        if (edge.type === 'line') {
          leaderLocation = [
            (edge.data.start[0] + edge.data.end[0]) / 2.0,
            (edge.data.start[1] + edge.data.end[1]) / 2.0,
            (edge.data.start[2] + edge.data.end[2]) / 2.0
          ];

          var noteLocationInViewSpace = leaderLocation;
          noteLocation = convertPointViewToPaper(noteLocationInViewSpace, viewToUse.viewToPaperMatrix.items);

          // Separate note from leader slightly
          noteLocation[0] -= 2.0;
          noteLocation[1] -= 2.0;

          // Should not need to upper case the id, but it is needed now.  Fixing it soon.
          leaderEdgeId = edge.uniqueId.toUpperCase();
          leaderViewId = viewToUse.viewId;
          break;
        }
      }
    }

    /**
     * Modify the drawing to create a note with leader
     */
    const jsonRequest = {
      messageName: 'onshapeCreateAnnotations',
      formatVersion: '2021-01-01',
      annotations: [
        {
          type: 'Onshape::Note',
          note: {
            position: {
              type: 'Onshape::Reference::Point',
              coordinate: noteLocation
            },
            contents: annotationText,
            leaderPosition: {
              type: 'Onshape::Reference::Point',
              coordinate: leaderLocation,
              uniqueId: leaderEdgeId,
              viewId: leaderViewId
            },
            textHeight: textHeight
          }
        }
      ]
    };

    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
      description: "Add note",
      jsonRequests: [ jsonRequest ]
    }) as BasicNode;
  
    const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (waitSucceeded) {
      console.log('Successfully created note with leader.');
      LOG.info(`Successfully created note with leader.`);
    } else {
      console.log('Create note with leader failed waiting for modify to finish.');
      LOG.info('Create note with leader failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create note with leader failed', error);
  }
}