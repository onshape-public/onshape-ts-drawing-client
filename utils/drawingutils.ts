import timeSpan from 'time-span';
import { mainLog } from './logger.js';
import { ArgumentParser } from './argumentparser.js';
import { ApiClient } from './apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse } from './onshapetypes.js';
import { GetDrawingJsonExportResponse, Sheet, TranslationStatusResponse, Annotation, View2 } from './onshapetypes.js';
import { AnnotationType } from './onshapetypes.js';

const LOG = mainLog();

export function usage(scriptName: string) {
  console.error(`Usage: npm run ${scriptName} --drawinguri=Xxx [--stack=Yyy]`);
}

/**
 * The typical response of modify POST request
 */
export interface ModifyJob extends BasicNode {
  /** The id of the job */
  id: string;
  /** Current completion status of translation job */
  requestState: 'ACTIVE' | 'DONE' | 'FAILED';
  /** The document that contains the drawing to be modified */
  documentId?: string;
  /** The element that contains the drawing to be modified */
  drawingElementId?: string;
  /** Reason why the modification failed if not DONE */
  failureReason?: string;
}

/**
 * The arguments from the script command line
 */
export class DrawingScriptArgs {
  /** The stack to use for credentials */
  stackToUse: string;
  /** The document id */
  documentId: string;
  /** The workspace id */
  workspaceId: string;
  /** The element id */
  elementId: string;
}

/**
 * @returns the parsed script arguments
 */
export function parseDrawingScriptArgs(): DrawingScriptArgs {

  const drawingUri: string = ArgumentParser.get('drawinguri');
  if (!drawingUri) {
    throw new Error('Please specify --drawinguri=Xxx as an argument');
  }

  let drawingScriptArgs: DrawingScriptArgs = {
    stackToUse: ArgumentParser.get('stack'),
    documentId: '',
    workspaceId: '',
    elementId: ''
  };

  LOG.info(`Processing docuri=${drawingUri}`);
  let url: URL = null;
  try {
    url = new URL(drawingUri);
  } catch (error) {
    throw new Error(`Failed to parse ${drawingUri} as valid URL`);
  }

  const lowerCasePath = url.pathname.toLowerCase();
  const regexMatch = lowerCasePath.match(/^\/documents\/([0-9a-f]{24})\/([wv])\/([0-9a-f]{24})\/e\/([0-9a-f]{24})$/);
  if (!regexMatch) {
    throw new Error(`Failed to extract documentId, workspaceId and elementId from ${lowerCasePath}`);
  }

  drawingScriptArgs.documentId = regexMatch[1];
  const wv: string = regexMatch[2];
  if (wv != 'w') {
    throw new Error('--documenturi must specify a drawing in a workspace');
  }
  drawingScriptArgs.workspaceId= regexMatch[3];
  drawingScriptArgs.elementId = regexMatch[4];

  return drawingScriptArgs;
}

export function getRandomLocation(minLocation: number[], maxLocation: number[]): number[] {
  // Position of note is random between (minLocation[0], minLocation[1]) and (maxLocation[0], maxLocation[1])
  const xPosition: number = minLocation[0] + (Math.random() * (maxLocation[0] - minLocation[0]));
  const yPosition: number = minLocation[1] + (Math.random() * (maxLocation[1] - minLocation[1]));
  return [xPosition, yPosition, 0.0];
}

export function getRandomInt(min: number, max: number) {
  // Return integer between lowerInt and upperInt inclusive
  let randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomInt;
}

export async function getDrawingJsonExport(apiClient: ApiClient, documentId: string, workspaceId: string, elementId: string): Promise<GetDrawingJsonExportResponse> {
  let exportData: GetDrawingJsonExportResponse = null;

  try {
    LOG.info('Initiated export of drawing as json');
    let exportResponse: ExportDrawingResponse = await apiClient.post(`api/drawings/d/${documentId}/w/${workspaceId}/e/${elementId}/translations`, {
      formatName: 'DRAWING_JSON',
      level: 'full',
      storeInDocument: false
    }) as ExportDrawingResponse;

    let translationStatus: TranslationStatusResponse = { requestState: 'ACTIVE', id: exportResponse.id, failureReason: '', resultExternalDataIds: [] };
    const end = timeSpan();
    while (translationStatus.requestState === 'ACTIVE') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const elapsedSeconds = end.seconds();

      // If export takes over 1 minute, then log and continue
      if (elapsedSeconds > 60) {
        LOG.error(`Export of drawing timed out after ${elapsedSeconds} seconds`);
        break;
      }

      LOG.debug(`Waited for export seconds=${elapsedSeconds}`);
      translationStatus = await apiClient.get(`api/translations/${exportResponse.id}`) as TranslationStatusResponse;
    }

    let translationId: string = translationStatus.resultExternalDataIds[0];
    console.log(`translation id=`, translationId);
    
    let responseAsString: string = await apiClient.get(`api/documents/d/${documentId}/externaldata/${translationStatus.resultExternalDataIds[0]}`) as string;
    exportData = JSON.parse(responseAsString);

  } catch (error) {
    console.error(error);
    LOG.error('Error getting drawing as json.', error);
  }

  return exportData;
}

export function getRandomViewOnActiveSheetFromExportData(exportData: GetDrawingJsonExportResponse): View2 {
  let viewToReturn: View2 = null;

  for (let indexSheet = 0; indexSheet < exportData.sheets.length; indexSheet++) {
    let sheet: Sheet = exportData.sheets[indexSheet];
    if (sheet.active === true) {
      if (sheet.views !== null && sheet.views.length > 0) {
        let randomIndex: number = getRandomInt(0, sheet.views.length-1)
        viewToReturn = sheet.views[randomIndex];
      } else {
        console.log('Active sheet has no views.');
        viewToReturn = null;
      }
      break;
    }
  }

  return viewToReturn;
}

export function getAnnotationsOfViewFromExportData(exportData: GetDrawingJsonExportResponse, view: View2): Annotation[] {
  let annotationsInView: Annotation[] = null;
  let annotationViewId = '';

  for (let indexSheet = 0; indexSheet < exportData.sheets.length; indexSheet++) {
    let sheet: Sheet = exportData.sheets[indexSheet];
    if (sheet.name === view.sheet) {
      for (let indexAnnotation = 0; indexAnnotation < sheet.annotations.length; indexAnnotation++) {
        let annotation: Annotation = sheet.annotations[indexAnnotation];
        if (annotation.type === AnnotationType.RADIAL_DIMENSION) {
          annotationViewId = annotation.radialDimension.centerPoint.viewId;
        } else if (annotation.type === AnnotationType.DIMENSION_POINT_TO_POINT_LINEAR) {
          annotationViewId = annotation.pointToPointDimension.point1.viewId;
        } else {
          annotationViewId = '';
        }

        if (annotationViewId === view.viewId) {
          if (annotationsInView === null) {
            annotationsInView = [annotation];
          } else {
            annotationsInView.push(annotation);
          }
        }
      }
      break;
    }
  }

  return annotationsInView;
}

/**
 * Return if the given arc axis is perpendicular to the view plane, which would mean
 * it is acceptable to place a radial or diametric dimension on it.
 */
export function isArcAxisPerpendicularToViewPlane(axisDir: number[]): boolean {
  /**
   * Arc should have an axis pointing in or out of the view - approximately (0, 0, 1) or (0, 0, -1).
   */
  const tolerance: number = 0.001;
  
  let perpendicularToViewPlane: boolean = (
    axisDir.length === 3 &&
    axisDir[0] < tolerance && axisDir[0] > -tolerance &&
    axisDir[1] < tolerance && axisDir[1] > -tolerance &&
    (axisDir[2] > tolerance || axisDir[2] < -tolerance)
  )

  return perpendicularToViewPlane;
}

export function convertPointViewToPaper(pointInView: number[], viewToPaperMatrix: number[]): number[] {
  let pointInPaper: number[] = null;

  if (pointInView.length === 3 && viewToPaperMatrix.length === 12) {
    pointInPaper = [0.0, 0.0, 0.0];
    pointInPaper[0] = viewToPaperMatrix[0] * pointInView[0] + viewToPaperMatrix[1] * pointInView[1] + viewToPaperMatrix[2] * pointInView[2] + viewToPaperMatrix[3];
    pointInPaper[1] = viewToPaperMatrix[4] * pointInView[0] + viewToPaperMatrix[5] * pointInView[1] + viewToPaperMatrix[6] * pointInView[2] + viewToPaperMatrix[7];
    pointInPaper[2] = viewToPaperMatrix[8] * pointInView[0] + viewToPaperMatrix[9] * pointInView[1] + viewToPaperMatrix[10] * pointInView[2] + viewToPaperMatrix[11];
  }

  return pointInPaper;
}

/**
 * Determine the midpoint of an arc.
 * Assume Z is constant, meaning the arc is flat in the view.
 */
export function midPointOfArc(centerPoint: number[], radius: number, startPoint: number[], endPoint: number[]): number[] {
  let midPoint: number[] = null;

  if (centerPoint.length === 3 && startPoint.length === 3 && endPoint.length === 3) {
    let xToStart: number = startPoint[0] - centerPoint[0];
    let yToStart = startPoint[1] - centerPoint[1];

    let angleToStart: number = Math.atan2(startPoint[1] - centerPoint[1], startPoint[0] - centerPoint[0]);
    let angleToEnd: number = Math.atan2(endPoint[1] - centerPoint[1], endPoint[0] - centerPoint[0]);
    if (angleToEnd < angleToStart) {
      angleToEnd += Math.PI;
    }
    let midPointAngle: number = (angleToStart + angleToEnd)/2.0;

    midPoint = [0.0, 0.0, 0.0];
    midPoint[0] = centerPoint[0] + radius * Math.cos(midPointAngle);
    midPoint[1] = centerPoint[1] + radius * Math.sin(midPointAngle);
    midPoint[2] = (startPoint[2] + endPoint[2]) / 2.0;
  }

  return midPoint;
}

export function getMidPoint(pointOne: number[], pointTwo: number[]): number[] {
  let midPoint: number[] = null;

  if (pointOne.length === 3 && pointTwo.length === 3) {
    midPoint = [
      (pointOne[0] + pointTwo[0]) / 2.0,
      (pointOne[1] + pointTwo[1]) / 2.0,
      (pointOne[2] + pointTwo[2]) / 2.0
    ];
  }

  return midPoint;
}

