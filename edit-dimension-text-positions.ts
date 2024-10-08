import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, GetDrawingJsonExportResponse, Annotation } from './utils/onshapetypes.js';
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
  usage('edit-dimension-text-positions');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewAnnotations: Annotation[] = null;
  
    /**
     * Retrieve annotations in the drawing
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewAnnotations = getAllDrawingAnnotationsInViewsFromExportData(drawingJsonExport);

    /**
     * Loop through annotations and create edit requests to move the dimension text 1 unit to the right
     */
    let editAnnotations: Annotation[] = null;
    for (let indexAnnotation = 0; indexAnnotation < viewAnnotations.length; indexAnnotation++) {
      let annotation: Annotation = viewAnnotations[indexAnnotation];
      let editAnnotation: Annotation = null;

      switch (annotation.type) {
        case DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR: {
          editAnnotation = {
            pointToPointDimension: {
              logicalId: annotation.pointToPointDimension.logicalId,
              textPosition: {
                coordinate: [
                  annotation.pointToPointDimension.textPosition.coordinate[0] + 1.0,
                  annotation.pointToPointDimension.textPosition.coordinate[1],
                  annotation.pointToPointDimension.textPosition.coordinate[2]
                ],
                type: 'Onshape::Reference::Point'
              }
            },
            type: DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR
          }
          break;
        }
        default: {
          editAnnotation = null;
          break;
        }
      }

      if (editAnnotation) {
        if (editAnnotations === null) {
          editAnnotations = [editAnnotation];
        } else {
          editAnnotations.push(editAnnotation);
        }
      }
    }
  
    if (editAnnotations && editAnnotations.length > 0) {
      const requestBody = {
        description: 'Edit linear dims',
        jsonRequests: [ {
          messageName: 'onshapeEditAnnotations',
          formatVersion: '2021-01-01',
          annotations: editAnnotations
        } ]
      }

      /**
       * Modify the drawing to edit the dimensions
       */
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;
  
      const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (waitSucceeded) {
        console.log('Successfully edited dimensions.');
        LOG.info(`Successfully edited dimensions.`);
      } else {
        console.log('Edit dimensions failed waiting for modify to finish.');
        LOG.info('Edit dimensions failed waiting for modify to finish.');
      }
    } else {
      console.log('No dimensions need to be edited.');
      LOG.error('No dimensions need to be edited.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Edit point to point linear dimensions failed:', error);
  }
}