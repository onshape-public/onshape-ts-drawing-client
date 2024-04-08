import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2, Annotation, AnnotationType, UnassociatedPoint } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation, getAnnotationsOfViewFromExportData } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, convertPointViewToPaper, getMidPoint } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  let viewToUse: View2 = null;
  let symbolPosition: number[] = null;
  let parentAnnotationLogicalId: string = null;
  let annotationsInView: Annotation[] = null;
  let annotationsToRequest: Object[] = null;

  /**
   * Retrieve a drawing view and some of its edges to get enough information to create the inspection symbol
   */
  let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
  viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);

  if (viewToUse != null) {
    annotationsInView = getAnnotationsOfViewFromExportData(drawingJsonExport, viewToUse);
  }

  if (viewToUse != null && annotationsInView !== null) {
    // Create the message to create inspection symbols for multiple dimensions in view
    for (let indexAnnotation = 0; indexAnnotation < annotationsInView.length; indexAnnotation++) {
      let annotation: Annotation = annotationsInView[indexAnnotation];
      switch (annotation.type) {
        case AnnotationType.DIMENSION_DIAMETER: {
          symbolPosition = annotation.diametricDimension.textPosition.coordinate;
          symbolPosition[0] += 0.5;
          parentAnnotationLogicalId = annotation.diametricDimension.logicalId;
          break;
        }
        case AnnotationType.DIMENSION_LINE_TO_LINE_ANGULAR: {
          symbolPosition = annotation.lineToLineAngularDimension.textPosition.coordinate;
          symbolPosition[0] += 0.5;
          parentAnnotationLogicalId = annotation.lineToLineAngularDimension.logicalId;
          break;
        }
        case AnnotationType.DIMENSION_LINE_TO_LINE_LINEAR: {
          symbolPosition = annotation.lineToLineDimension.textPosition.coordinate;
          symbolPosition[0] += 0.5;
          parentAnnotationLogicalId = annotation.lineToLineDimension.logicalId;
          break;
        }
        case AnnotationType.DIMENSION_POINT_TO_LINE_LINEAR: {
          symbolPosition = annotation.pointToLineDimension.textPosition.coordinate;
          symbolPosition[0] += 0.5;
          parentAnnotationLogicalId = annotation.pointToLineDimension.logicalId;
          break;
        }
        case AnnotationType.DIMENSION_POINT_TO_POINT_LINEAR: {
          symbolPosition = annotation.pointToPointDimension.textPosition.coordinate;
          symbolPosition[0] += 0.5;
          parentAnnotationLogicalId = annotation.pointToPointDimension.logicalId;
          break;
        }
        case AnnotationType.DIMENSION_RADIAL: {
          symbolPosition = annotation.radialDimension.textPosition.coordinate;
          symbolPosition[0] += 0.5;
          parentAnnotationLogicalId = annotation.radialDimension.logicalId;
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
          type: 'Onshape::InspectionSymbol',
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
        description: "Add Inspection Symbol",
        jsonRequests: [ {
          messageName: 'onshapeCreateAnnotations',
          formatVersion: '2021-01-01',
          annotations: annotationsToRequest
        }]
      }) as BasicNode;

      const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (waitSucceeded) {
        console.log('Successfully created inspection symbols.');
        LOG.info(`Successfully created inspection symbols.`);
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
  usage('create-inspection-symbols');
  console.error(error);
  LOG.error('Create inspection symbol failed: ', error);
}
