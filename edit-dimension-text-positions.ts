import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, GetDrawingJsonExportResponse, Annotation, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
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
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
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

      const requestBodyAsString: string = JSON.stringify(requestBody);
      console.log(requestBodyAsString);

      /**
       * Modify the drawing to edit the dimensions
       */
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;
  
      const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (responseOutput) {
        if (responseOutput.results.length == 0) {
          // Success, but the logicalId is not available yet
          console.log('Edit dimension succeeded.');
        } else {
          // Only 1 request was made - verify it succeeded
          if (responseOutput.results.length == 1 &&
            responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
            // Success - logicalId of new dimension is available
            const newLogicalId = responseOutput.results[0].logicalId;
            console.log(`Edit dimension succeeded and has a logicalId: ${newLogicalId}`);
          } else {
            console.log(`Edit dimension failed. Response status code: ${responseOutput.statusCode}.`)
          }
        }
      } else {
        console.log('Edit dimension failed waiting for modify to finish.');
        LOG.info('Edit dimension failed waiting for modify to finish.');
      }

      if (responseOutput) {
        let countSucceeded = 0;
        let countFailed = 0;
        for (let iResultCount: number = 0; iResultCount < responseOutput.results.length; iResultCount++) {
          let currentResult = responseOutput.results[iResultCount];
          if (currentResult.status === SingleRequestResultStatus.RequestSuccess) {
            countSucceeded++;
          } else {
            countFailed++;
          }
        }
        console.log(`Successfully edited ${countSucceeded} of ${editAnnotations.length} dimensions.`);
        if (countFailed > 0) {
          console.log(`Failed to edit ${countFailed} dimension text positions.`);
        }
        if (editAnnotations.length !== (countSucceeded + countFailed)) {
          let countTotal = countSucceeded + countFailed;
          console.log(`Mismatch in number of dimension edits requested (${editAnnotations.length}) and response (${countTotal}).`);
        }
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