import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, View2, Annotation, AnnotationType, UnassociatedPoint } from './utils/onshapetypes.js';
import { usage, ModifyJob, DrawingScriptArgs, parseDrawingScriptArgs, getRandomLocation, getAnnotationsOfViewFromExportData } from './utils/drawingutils.js';
import { getDrawingJsonExport, getRandomViewOnActiveSheetFromExportData, convertPointViewToPaper, getMidPoint } from './utils/drawingutils.js';

const LOG = mainLog();

try {
  const drawingScriptArgs: DrawingScriptArgs = parseDrawingScriptArgs();
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);

  const apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  let viewToUse: View2 = null;
  let textPosition: number[] = null;
  let parentAnnotationLogicalId: string = null;
  let annotationsInView: Annotation[] = null;
  let symbolPosition: number[] = null;

  /**
   * Retrieve a drawing view and some of its edges to get enough information to create the inspection symbol
   */
  try {
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    viewToUse = getRandomViewOnActiveSheetFromExportData(drawingJsonExport);

    if (viewToUse != null) {
      annotationsInView = getAnnotationsOfViewFromExportData(drawingJsonExport, viewToUse);
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create inspection symbol failed in retrieve view and annotations.', error);
  }

  if (viewToUse != null && annotationsInView !== null) {

    try {
      for (let indexAnnotation = 0; indexAnnotation < annotationsInView.length; indexAnnotation++) {
        let annotation: Annotation = annotationsInView[indexAnnotation];
        if (annotation.type === AnnotationType.RADIAL_DIMENSION) {
          textPosition = annotation.radialDimension.textPosition.coordinate;
          parentAnnotationLogicalId = annotation.radialDimension.logicalId;
        } else if (annotation.type === AnnotationType.DIMENSION_POINT_TO_POINT_LINEAR) {
          textPosition = annotation.pointToPointDimension.textPosition.coordinate;
          parentAnnotationLogicalId = annotation.pointToPointDimension.logicalId;
        } else {
          textPosition = null;
          parentAnnotationLogicalId = null;
        }
  
        if (textPosition !== null && parentAnnotationLogicalId !== null) {
          // Create request to create an inspection symbol on the annotation
          const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
            description: "Add Inspection Symbol",
            jsonRequests: [ {
              messageName: 'onshapeCreateAnnotations',
              formatVersion: '2021-01-01',
              annotations: [
                {
                  type: 'Onshape::InspectionSymbol',
                  inspectionSymbol: {
                    borderShape: 'Circle',
                    borderSize: 2,
                    parentAnnotation: parentAnnotationLogicalId,
                    parentLineIndex: 0.0,
                    position: {
                      coordinate: textPosition,
                      type: 'Onshape::Reference::Point'
                    },
                    textHeight: 0.12
                  }
                }
              ]
            }]
          }) as BasicNode;
    
          LOG.info('Initiated creation of inspection symbol in drawing', modifyRequest);
          let jobStatus: ModifyJob = { requestState: 'ACTIVE', id: '' };
          const end = timeSpan();
          while (jobStatus.requestState === 'ACTIVE') {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const elapsedSeconds = end.seconds();
    
            // If modify takes over 1 minute, then log and continue
            if (elapsedSeconds > 60) {
              LOG.error(`Inspection symbol creation timed out after ${elapsedSeconds} seconds`);
              break;
            }
    
            LOG.debug(`Waited for modify seconds=${elapsedSeconds}`);
            jobStatus = await apiClient.get(`api/drawings/modify/status/${modifyRequest.id}`) as ModifyJob;
          }
        }
      }

      LOG.info(`Created inspection symbols`);
    } catch (error) {
      console.error(error);
      LOG.error('Create inspection symbol failed in modify API call', error);
    }
  } else {
    console.log('Insufficient view and annotation information to create the inspection symbols.');
    LOG.error('Create inspection symbols failed due to insufficient view and annotation information.');
  }

} catch (error) {
  usage('create-inspection-symbol');
  console.error(error);
  LOG.error('Create inspection symbol failed', error);
}
