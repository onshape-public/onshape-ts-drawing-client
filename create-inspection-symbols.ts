import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingJsonExportResponse, View2, Annotation, DrawingObjectType, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, getAnnotationsOfViewAndSheetFromExportData } from './utils/drawingutils.js';

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
  usage('create-inspection-symbols');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    let viewToUse: View2 = null;
    let symbolPosition: number[] = null;
    let parentAnnotationLogicalId: string = null;
    let annotationsInViewAndSheet: Annotation[] = null;
    let annotationsToRequest: Object[] = null;
  
    /**
     * Retrieve a drawing view and some of its edges to get enough information to create the inspection symbol
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);
  
    if (viewToUse != null) {
      annotationsInViewAndSheet = getAnnotationsOfViewAndSheetFromExportData(drawingJsonExport, viewToUse, true);
    }
  
    if (viewToUse != null && annotationsInViewAndSheet !== null) {
      // Create the message to create inspection symbols for multiple dimensions in view
      for (let indexAnnotation = 0; indexAnnotation < annotationsInViewAndSheet.length; indexAnnotation++) {
        let annotation: Annotation = annotationsInViewAndSheet[indexAnnotation];
        switch (annotation.type) {
          case DrawingObjectType.CALLOUT: {
            symbolPosition = annotation.callout.position.coordinate;
            symbolPosition[0] += 1.0;
            parentAnnotationLogicalId = annotation.callout.logicalId;
            break;
          }
          case DrawingObjectType.DIMENSION_DIAMETER: {
            symbolPosition = annotation.diametricDimension.textPosition.coordinate;
            symbolPosition[0] += 0.5;
            parentAnnotationLogicalId = annotation.diametricDimension.logicalId;
            break;
          }
          case DrawingObjectType.DIMENSION_LINE_TO_LINE_ANGULAR: {
            symbolPosition = annotation.lineToLineAngularDimension.textPosition.coordinate;
            symbolPosition[0] += 0.5;
            parentAnnotationLogicalId = annotation.lineToLineAngularDimension.logicalId;
            break;
          }
          case DrawingObjectType.DIMENSION_LINE_TO_LINE_LINEAR: {
            symbolPosition = annotation.lineToLineDimension.textPosition.coordinate;
            symbolPosition[0] += 0.5;
            parentAnnotationLogicalId = annotation.lineToLineDimension.logicalId;
            break;
          }
          case DrawingObjectType.DIMENSION_POINT_TO_LINE_LINEAR: {
            symbolPosition = annotation.pointToLineDimension.textPosition.coordinate;
            symbolPosition[0] += 0.5;
            parentAnnotationLogicalId = annotation.pointToLineDimension.logicalId;
            break;
          }
          case DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR: {
            symbolPosition = annotation.pointToPointDimension.textPosition.coordinate;
            symbolPosition[0] += 0.5;
            parentAnnotationLogicalId = annotation.pointToPointDimension.logicalId;
            break;
          }
          case DrawingObjectType.DIMENSION_RADIAL: {
            symbolPosition = annotation.radialDimension.textPosition.coordinate;
            symbolPosition[0] += 0.5;
            parentAnnotationLogicalId = annotation.radialDimension.logicalId;
            break;
          }
          case DrawingObjectType.DIMENSION_THREE_POINT_ANGULAR: {
            symbolPosition = annotation.threePointAngularDimension.textPosition.coordinate;
            symbolPosition[0] += 0.5;
            parentAnnotationLogicalId = annotation.threePointAngularDimension.logicalId;
            break;
          }
          case DrawingObjectType.GEOMETRIC_TOLERANCE: {
            symbolPosition = annotation.geometricTolerance.position.coordinate;
            symbolPosition[0] += 1.0;
            parentAnnotationLogicalId = annotation.geometricTolerance.logicalId;
            break;
          }
          case DrawingObjectType.NOTE: {
            // We do not want to generate inspection symbols on notes in the titleblock and borders
            // and there is no way to distinguish them now.  So skipping notes for now.
            symbolPosition = null;
            parentAnnotationLogicalId = null;
            break;
          }
          default: {
            symbolPosition = null;
            parentAnnotationLogicalId = null;
            break;
          }
        }
  
        if (symbolPosition !== null && parentAnnotationLogicalId !== null) {
          let annotationRequest = {
            type: DrawingObjectType.INSPECTION_SYMBOL,
            inspectionSymbol: {
              borderShape: 'Circle',
              borderSize: 2,
              parentAnnotation: parentAnnotationLogicalId,
              parentLineIndex: 0.0,
              position: {
                coordinate: symbolPosition,
                type: 'Onshape::Reference::Point'
              },
              textHeight: 0.12
            }
          }
          if (annotationsToRequest === null) {
            annotationsToRequest = [ annotationRequest ];
          } else {
            annotationsToRequest.push(annotationRequest);
          }
        }
      }     
        
      if (annotationsToRequest !== null) {
        // Post request to create inspection symbols on the dimensions
        const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
          description: 'Add Inspection Symbol',
          jsonRequests: [ {
            messageName: 'onshapeCreateAnnotations',
            formatVersion: '2021-01-01',
            annotations: annotationsToRequest
          }]
        }) as BasicNode;
  
        const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
        if (responseOutput) {
          if (responseOutput.results.length == 0) {
            // Success, but the logicalId is not available yet
            console.log('Create geometric tolerance succeeded.');
          } else {
            // Only 1 request was made - verify it succeeded
            if (responseOutput.results.length == 1 &&
              responseOutput.results[0].status === SingleRequestResultStatus.RequestSuccess) {
              // Success - logicalId of new geometric tolerance is available
              const newLogicalId = responseOutput.results[0].logicalId;
              console.log(`Create geometric tolerance succeeded and has a logicalId: ${newLogicalId}`);
            } else {
              console.log(`Create geometric tolerance failed. Response status code: ${responseOutput.statusCode}.`)
            }
          }
        } else {
          console.log('Create geometric tolerance failed waiting for modify to finish.');
          LOG.info('Create geometric tolerance failed waiting for modify to finish.');
        }

        if (responseOutput) {
          let countSucceeded = 0;
          let countFailed = 0;
          for (let iResultCount: number = 0; iResultCount < responseOutput.results.length; iResultCount++) {
            let currentResult = responseOutput.results[iResultCount];
            // currentResult.logicalId has the logicalId of each created inspection symbol
            if (currentResult.status === SingleRequestResultStatus.RequestSuccess) {
              countSucceeded++;
            } else {
              countFailed++;
            }
          }
          console.log(`Successfully created ${countSucceeded} of ${annotationsToRequest.length} inspection symbols.`);
          if (countFailed > 0) {
            console.log(`Failed to create ${countFailed} inspection symbols.`);
          }
          if (annotationsToRequest.length !== (countSucceeded + countFailed)) {
            let countTotal = countSucceeded + countFailed;
            console.log(`Mismatch in number of inspection symbols requested (${annotationsToRequest.length}) and response (${countTotal}).`);
          }
        } else {
          console.log('Create inspection symbols failed waiting for modify to finish.');
          LOG.info('Create inspection symbols failed waiting for modify to finish.');
        }
      } else {
        console.log('No dimensions found on which to create the inspection symbols.');
        LOG.error('Create inspection symbols failed due to no dimensions found.');  
      }
    } else {
      console.log('Insufficient view and annotation information to create the inspection symbols.');
      LOG.error('Create inspection symbols failed due to insufficient view and annotation information.');
    }
  
  } catch (error) {
    console.error(error);
    LOG.error('Create inspection symbol failed: ', error);
  }
}

