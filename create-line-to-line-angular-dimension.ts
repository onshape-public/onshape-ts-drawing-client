import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, Edge, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2, SnapPointType, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, convertPointViewToPaper, getMidPoint, areParallelEdges } from './utils/drawingutils.js';

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
  usage('create-line-to-line-angular-dimension');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
    let arcPoint: number[] = null;
    let point1: number[] = null;
    let point2: number[] = null;
    let point3: number[] = null;
    let point4: number[] = null;
    let textLocation: number[] = null;
    let firstEdgeUniqueId: string = null;
    let secondEdgeUniqueId: string = null;
  
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
        // Want line edge
        if (edge.type === 'line') {
          if (point1 === null) {
            point1 = edge.data.start;
            point2 = edge.data.end;
            firstEdgeUniqueId = edge.uniqueId;  
          } else if (!areParallelEdges(point1, point2, edge.data.start, edge.data.end)) {
            point3 = edge.data.start;
            point4 = edge.data.end;
            secondEdgeUniqueId = edge.uniqueId;
          
            // Put arc point and text location out from mid point by arbitrary amount
            arcPoint = getMidPoint(point1, point3);
            textLocation = arcPoint;
            textLocation[0] += 0.003;
            textLocation[1] += 0.003;
            textLocation = convertPointViewToPaper(textLocation, viewToUse.viewToPaperMatrix.items);
            break;
          }
        }
      }
    }

    if (viewToUse != null && point1 !== null && point3 !== null && firstEdgeUniqueId !== null && secondEdgeUniqueId !== null) {

      const requestBody = {
        description: 'Add angular dim',
        jsonRequests: [ 
          {
            messageName: 'onshapeCreateAnnotations',
            formatVersion: '2021-01-01',
            annotations: [
              {
                type: DrawingObjectType.DIMENSION_LINE_TO_LINE_ANGULAR,
                lineToLineAngularDimension: {
                  arcPoint: {
                    coordinate: arcPoint,
                    type: 'Onshape::Reference::Point',
                    uniqueId: firstEdgeUniqueId,
                    viewId: viewToUse.viewId,
                    snapPointType: SnapPointType.ModeNear
                  },
                  point1: {
                    coordinate: point1,
                    type: 'Onshape::Reference::Point',
                    uniqueId: firstEdgeUniqueId,
                    viewId: viewToUse.viewId,
                    snapPointType: SnapPointType.ModeStart
                  },
                  point2: {
                    coordinate: point2,
                    type: 'Onshape::Reference::Point',
                    uniqueId: firstEdgeUniqueId,
                    viewId: viewToUse.viewId,
                    snapPointType: SnapPointType.ModeEnd
                  },
                  point3: {
                    coordinate: point3,
                    type: 'Onshape::Reference::Point',
                    uniqueId: secondEdgeUniqueId,
                    viewId: viewToUse.viewId,
                    snapPointType: SnapPointType.ModeStart
                  },
                  point4: {
                    coordinate: point4,
                    type: 'Onshape::Reference::Point',
                    uniqueId: secondEdgeUniqueId,
                    viewId: viewToUse.viewId,
                    snapPointType: SnapPointType.ModeEnd
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
          }
        ]
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
    LOG.error('Create line to line angular dimension failed', error);
  }
}