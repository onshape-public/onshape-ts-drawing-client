import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { GetDrawingJsonExportResponse, Sheet, View2, DrawingObjectType, Annotation, ErrorStateValue, ErrorState } from './utils/onshapetypes.js';
import { usage, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport } from './utils/drawingutils.js';

const LOG = mainLog();

let drawingScriptArgs: DrawingScriptArgs = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;
let errorValue: string = null;
let viewErrorsFound: boolean = false;
let annotationErrorsFound: boolean = false;
let workspaceOrVersionId = '';
let workspaceOrVersion = '';

try {
  drawingScriptArgs = parseDrawingScriptArgs();
  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  validateBaseURLs(apiClient.getBaseURL(), drawingScriptArgs.baseURL);

  // This script can handle both workspaces and versions
  if (drawingScriptArgs.workspaceId) {
    workspaceOrVersionId = drawingScriptArgs.workspaceId;
    workspaceOrVersion = 'w';
  } else {
    workspaceOrVersionId = drawingScriptArgs.versionId;
    workspaceOrVersion = 'v';
  }  
} catch (error) {
  validArgs = false;
  usage('find-errors-in-drawing');
}

if (validArgs) {
  LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, versionId=${drawingScriptArgs.versionId}, elementId=${drawingScriptArgs.elementId}`);

  try {
  
    /**
     * Do a drawing export to get the views and annotations in the drawing
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, workspaceOrVersion, workspaceOrVersionId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    
    for (let indexSheet = 0; indexSheet < drawingJsonExport.sheets.length; indexSheet++) {

      viewErrorsFound = false;
      annotationErrorsFound = false;

      let sheet: Sheet = drawingJsonExport.sheets[indexSheet];

      console.log(`Sheet ${sheet.name}:`)

      // Check for views on the sheet that have a bad error state
      for (let indexView = 0; indexView < sheet.views.length; indexView++) {
        let aView: View2 = sheet.views[indexView];

        errorValue = null;
        if (aView.hasOwnProperty('errorState')) {
          switch (aView.errorState.value) {
            case ErrorStateValue.OK:
              errorValue = null;
              break;
            case ErrorStateValue.INFO:
              errorValue = "INFO";
              break;
            case ErrorStateValue.WARNING:
              errorValue = "WARNING";
              break;
            case ErrorStateValue.ERROR:
              errorValue = "ERROR";
              break;
            case ErrorStateValue.UNKNOWN:
              errorValue = "UNKNOWN";
              break;
            default: {
              errorValue = null;
              break;
            }
          }
        }

        if (errorValue) {
          viewErrorsFound = true;
          const viewName = aView.name.replaceAll('\n', ' ');
          const viewLabel = aView.label.replaceAll('\n', ' ');
          console.log(`  View name: ${viewName} id: ${aView.viewId} label:  ${viewLabel} has ${errorValue}: ${aView.errorState.description}.`);
        }
      }

      if (!viewErrorsFound) {
        console.log('  All views are healthy.');
      }

      // Check for annotations on the sheet that are dangling
      for (let indexAnnotation = 0; indexAnnotation < sheet.annotations.length; indexAnnotation++) {
        let anAnnotation: Annotation = sheet.annotations[indexAnnotation];
        let isDangling: boolean = false;
        let logicalId: string = '';
        let friendlyType: string = '';
        switch (anAnnotation.type) {
          case DrawingObjectType.DIMENSION_DIAMETER: {
            isDangling = anAnnotation.diametricDimension.isDangling;
            logicalId = anAnnotation.diametricDimension.logicalId;
            friendlyType = 'Diameter dimension';
            break;
          }
          case DrawingObjectType.DIMENSION_LINE_TO_LINE_ANGULAR: {
            isDangling = anAnnotation.lineToLineAngularDimension.isDangling;
            logicalId = anAnnotation.lineToLineAngularDimension.logicalId;
            friendlyType = 'Line to line angular dimension';
            break;
          }
          case DrawingObjectType.DIMENSION_LINE_TO_LINE_LINEAR: {
            isDangling = anAnnotation.lineToLineDimension.isDangling;
            logicalId = anAnnotation.lineToLineDimension.logicalId;
            friendlyType = 'Line to line linear dimension';
            break;
          }
          case DrawingObjectType.DIMENSION_POINT_TO_LINE_LINEAR: {
            isDangling = anAnnotation.pointToLineDimension.isDangling;
            logicalId = anAnnotation.pointToLineDimension.logicalId;
            friendlyType = 'Point to line linear dimension';
            break;
          }
          case DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR: {
            isDangling = anAnnotation.pointToPointDimension.isDangling;
            logicalId = anAnnotation.pointToPointDimension.logicalId;
            friendlyType = 'Point to point linear dimension';
            break;
          }
          case DrawingObjectType.DIMENSION_RADIAL: {
            isDangling = anAnnotation.radialDimension.isDangling;
            logicalId = anAnnotation.radialDimension.logicalId;
            friendlyType = 'Radial dimension';
            break;
          }
          case DrawingObjectType.DIMENSION_THREE_POINT_ANGULAR: {
            isDangling = anAnnotation.threePointAngularDimension.isDangling;
            logicalId = anAnnotation.threePointAngularDimension.logicalId;
            friendlyType = 'Three point angular dimension';
            break;
          }
          case DrawingObjectType.CALLOUT: {
            isDangling = anAnnotation.callout.isDangling ?? false;
            logicalId = anAnnotation.callout.logicalId ?? '';
            friendlyType = 'Callout';
            break;
          }
          case DrawingObjectType.CENTERLINE_POINT_TO_POINT: {
            isDangling = anAnnotation.pointToPointCenterline.isDangling ?? false;
            logicalId = anAnnotation.pointToPointCenterline.logicalId ?? '';
            friendlyType = 'Point to point centerline';
            break;
          }
          case DrawingObjectType.CENTERLINE_LINE_TO_LINE: {
            isDangling = anAnnotation.lineToLineCenterline.isDangling ?? false;
            logicalId = anAnnotation.lineToLineCenterline.logicalId ?? '';
            friendlyType = 'Line to line centerline';
            break;
          }
          case DrawingObjectType.CENTERLINE_TWO_POINT_CIRCULAR: {
            isDangling = anAnnotation.twoPointCircleCenterline.isDangling ?? false;
            logicalId = anAnnotation.twoPointCircleCenterline.logicalId ?? '';
            friendlyType = 'Two point circle centerline';
            break;
          }
          case DrawingObjectType.CENTERLINE_THREE_POINT_CIRCULAR: {
            isDangling = anAnnotation.threePointCircleCenterline.isDangling ?? false;
            logicalId = anAnnotation.threePointCircleCenterline.logicalId ?? '';
            friendlyType = 'Three point circle centerline';
            break;
          }
          case DrawingObjectType.GEOMETRIC_TOLERANCE: {
            isDangling = anAnnotation.geometricTolerance.isDangling ?? false;
            logicalId = anAnnotation.geometricTolerance.logicalId ?? '';
            friendlyType = "Geometric tolerance";
            break;
          }
          case DrawingObjectType.NOTE: {
            isDangling = anAnnotation.note.isDangling ?? false;
            logicalId = anAnnotation.note.logicalId ?? '';
            friendlyType = "Note";
            break;
          }
          case DrawingObjectType.CHAMFER_NOTE: {
            isDangling = anAnnotation.chamferNote.isDangling ?? false;
            logicalId = anAnnotation.chamferNote.logicalId ?? '';
            friendlyType = "Chamfer dimension";
            break;
          }
          case DrawingObjectType.INSPECTION_SYMBOL: {
            isDangling = anAnnotation.inspectionSymbol.isDangling ?? false;
            logicalId = anAnnotation.inspectionSymbol.logicalId ?? '';
            friendlyType = "Inspection symbol";
            break;
          }
          case DrawingObjectType.TABLE:
          default:
            // No isDangling field yet on these types of annotations
            break;
        }

        if (isDangling) {
          annotationErrorsFound = true;
          console.log(`  ${friendlyType} logicalId: ${logicalId} is dangling.`)
        }
      }

      if (!annotationErrorsFound) {
        console.log('  All annotations are healthy.');
      }
    }
  } catch (error) {
    console.error(error);
    LOG.error('Find errors in drawing failed: ', error);
  }
}