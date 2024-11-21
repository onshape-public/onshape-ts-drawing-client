import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, Edge, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, SnapPointType, Annotation, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport, getAllDrawingAnnotationsInViewsFromExportData } from './utils/drawingutils.js';

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
  usage('edit-dimension-attachments');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewAnnotations: Annotation[] = null;
    let dimensionToEdit: Annotation = null;
    let dimensionViewId: string = null;
    let dimensionPoint1EdgeUniqueId: string = null;
    let dimensionPoint2EdgeUniqueId: string = null;
    let newEdge: Edge = null;
  
    /**
     * Retrieve annotations in the drawing
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewAnnotations = getAllDrawingAnnotationsInViewsFromExportData(drawingJsonExport);

    /**
     * Loop through annotations and find one point to point linear dimension
     */
    let editAnnotations: Annotation[] = null;
    for (let indexAnnotation = 0; indexAnnotation < viewAnnotations.length; indexAnnotation++) {
      let annotation: Annotation = viewAnnotations[indexAnnotation];
      if (annotation.type === DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR) {
        dimensionToEdit = annotation;
        dimensionViewId = annotation.pointToPointDimension.point1.viewId;
        dimensionPoint1EdgeUniqueId = annotation.pointToPointDimension.point1.uniqueId.toLowerCase();
        dimensionPoint2EdgeUniqueId = annotation.pointToPointDimension.point2.uniqueId.toLowerCase();
        break;
      }
    }

    /**
     * Get the edges of the view containing the dimension to edit
     */
    if (dimensionToEdit !== null && dimensionViewId) {
      let retrieveViewJsonGeometryResponse: GetViewJsonGeometryResponse = null;
      let point1: number[] = null;
  
      LOG.info('Initiated retrieval of view json geometry');
      retrieveViewJsonGeometryResponse = await apiClient.get(`api/appelements/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/views/${dimensionViewId}/jsongeometry`) as GetViewJsonGeometryResponse;
    
      for (let indexEdge = 0; indexEdge < retrieveViewJsonGeometryResponse.bodyData.length; indexEdge++) {
        let edge: Edge = retrieveViewJsonGeometryResponse.bodyData[indexEdge];
        // Want to find a new line edge that isn't one of the existing point edges
        if (edge.type === 'line' &&
          dimensionPoint1EdgeUniqueId !== edge.uniqueId &&
          dimensionPoint2EdgeUniqueId !== edge.uniqueId) {
          newEdge = edge;
          break;
        }
      }
    } else {
      console.log('Failed - did not find a point to point linear dimension to edit.');
      LOG.info('Failed - did not find a point to point linear dimension to edit.');
    }

    if (newEdge) {
      const requestBody = {
        description: 'Edit linear dims',
        jsonRequests: [ {
          messageName: 'onshapeEditAnnotations',
          formatVersion: '2021-01-01',
          annotations: [ {
            pointToPointDimension: {
              logicalId: dimensionToEdit.pointToPointDimension.logicalId,
              point1: {
                coordinate: newEdge.data.start,
                snapPointType: SnapPointType.ModeStart,
                type: 'Onshape::Reference::Point',
                uniqueId: newEdge.uniqueId,
                viewId: dimensionViewId
              },
              point2: {
                coordinate: newEdge.data.end,
                snapPointType: SnapPointType.ModeEnd,
                type: 'Onshape::Reference::Point',
                uniqueId: newEdge.uniqueId,
                viewId: dimensionViewId
              }
            },
            type: DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR
          } ]
        } ]
      }
  
      /**
       * Modify the drawing to edit the dimension
       */
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;
    
      const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (responseOutput) {
        // Only 1 request was made - verify it succeeded
        if (responseOutput.results.length == 1 &&
            responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
          // Success - logicalId of new dimension is available
          const newLogicalId = responseOutput.results[0].logicalId;
          console.log(`Edit dimension succeeded and has a logicalId: ${newLogicalId}`);
        } else {
          console.log(`Edit dimension failed. Response status code: ${responseOutput.statusCode}.`)
        }
      } else {
        console.log('Edit dimension failed waiting for modify to finish.');
        LOG.info('Edit dimension failed waiting for modify to finish.');
      }
    }
  } catch (error) {
    console.error(error);
    LOG.error('Edit point to point linear dimensions failed:', error);
  }
}