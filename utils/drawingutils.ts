import timeSpan from 'time-span';
import { mainLog } from './logger.js';
import { ArgumentParser } from './argumentparser.js';
import { ApiClient } from './apiclient.js';
import { BasicNode, ExportDrawingResponse, ModifyStatusResponseOutput } from './onshapetypes.js';
import { GetDrawingJsonExportResponse, Sheet, TranslationStatusResponse, Annotation, View2, DrawingReference, ResolveReferencesResponse } from './onshapetypes.js';
import { DrawingObjectType } from './onshapetypes.js';

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
  /** Output from job */
  output?: string;
}

/**
 * The arguments from the script command line
 */
export class DrawingScriptArgs {
  /** The stack to use for credentials */
  stackToUse: string;
  /** The base URL */
  baseURL: string;
  /** The document id */
  documentId: string;
  /** The workspace id */
  workspaceId: string;
  /** The version id */
  versionId: string;
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
    baseURL: '',
    documentId: '',
    workspaceId: '',
    versionId: '',
    elementId: ''
  };

  LOG.info(`Processing drawinguri=${drawingUri}`);
  let url: URL = null;
  try {
    url = new URL(drawingUri);
  } catch (error) {
    throw new Error(`Failed to parse ${drawingUri} as valid URL`);
  }

  drawingScriptArgs.baseURL = url.origin.toLowerCase();

  const lowerCasePath = url.pathname.toLowerCase();
  const regexMatch = lowerCasePath.match(/^\/documents\/([0-9a-f]{24})\/([wv])\/([0-9a-f]{24})\/e\/([0-9a-f]{24})$/);
  if (!regexMatch) {
    throw new Error(`Failed to extract documentId, workspaceId and elementId from ${lowerCasePath}`);
  }

  drawingScriptArgs.documentId = regexMatch[1];
  const wv: string = regexMatch[2];
  if (wv == 'w') {
    drawingScriptArgs.workspaceId = regexMatch[3];
    drawingScriptArgs.versionId = '';
  } else if (wv == 'v') {
    drawingScriptArgs.workspaceId = '';
    drawingScriptArgs.versionId = regexMatch[3];
  }
  drawingScriptArgs.elementId = regexMatch[4];

  return drawingScriptArgs;
}

/**
 * The base URL in the credentials.json should match the base URL of the documenturi argument.
 * Warn if they do not match.  It's possible they are the same and not match (e.g. 127.0.0.1 and localhost).
 */
export function validateBaseURLs(credentialsBaseURL: string, argumentsBaseURL: string) {
  if (credentialsBaseURL !== argumentsBaseURL) {
    console.log(`WARNING: Credentials base URL ${credentialsBaseURL} does not match drawinguri base URL ${argumentsBaseURL}.`);
  }
}

/**
 * Return a random location between (minLocation[0], minLocation[1]) and (maxLocation[0], maxLocation[1])
 * @param minLocation 
 * @param maxLocation 
 * @returns random location
 */
export function getRandomLocation(minLocation: number[], maxLocation: number[]): number[] {
  const xPosition: number = minLocation[0] + (Math.random() * (maxLocation[0] - minLocation[0]));
  const yPosition: number = minLocation[1] + (Math.random() * (maxLocation[1] - minLocation[1]));
  return [xPosition, yPosition, 0.0];
}

export function getRandomInt(min: number, max: number) {
  // Return integer between lowerInt and upperInt inclusive
  let randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomInt;
}

/**
 * Return if a single drawing needs an update (e.g. the yellow update button would be highlighted)
 * @param apiClient 
 * @param documentId 
 * @param workspaceId 
 * @param elementId 
 * @returns boolean
 */
export async function getIfDrawingNeedsUpdate(apiClient: ApiClient, documentId: string, workspaceId: string, elementId: string): Promise<boolean> {
  let drawingNeedsUpdate = false;

  try {
    LOG.info('Initiated retrieval of drawing references');
    // drawingsOnly=true query parameter is required
    let resolveReferenceResponse: ResolveReferencesResponse = await apiClient.get(`api/v9/appelements/d/${documentId}/w/${workspaceId}/e/${elementId}/resolvereferences?includeInternal=false`) as any;

    // Loop through drawing resolved references, looking for out-of-date references
    for (let indexReference = 0; indexReference < resolveReferenceResponse.resolvedReferences.length; indexReference++) {
      let resolvedReference: DrawingReference = resolveReferenceResponse.resolvedReferences[indexReference];
      // If the latest element microversion is not the same as the target element microversion, it means
      // the target element has changed since the last time the drawing was updated.
      if (resolvedReference.latestElementMicroversionId !== resolvedReference.targetElementMicroversionId) {
        drawingNeedsUpdate = true;
        break;
      }
    }
  } catch (error) {
    console.error(error);
    LOG.error('Error getting drawing references.', error);
  }

  return drawingNeedsUpdate;
}

/**
 * Return the drawings in a document workspace that need an update (e.g. the yellow update button would be highlighted).
 * Returns an array of drawing element ids.
 */
export async function getWorkspaceDrawingsThatNeedUpdate(apiClient: ApiClient, documentId: string, workspaceId: string): Promise<string[]> {
  let drawingsThatNeedUpdate: string[] = null;

  try {
    LOG.info('Initiated retrieval of workspace drawing references');
    // drawingsOnly=true query parameter is required
    let resolveReferenceResponse: any = await apiClient.get(`api/v9/appelements/d/${documentId}/w/${workspaceId}/resolvereferences?includeInternal=false&drawingsOnly=true`) as any;

    for (const key in resolveReferenceResponse) {
      let drawingElementId = key;
      let drawingReferenceResponse: ResolveReferencesResponse = resolveReferenceResponse[drawingElementId];

      // Loop through drawing references, looking for out-of-date references
      for (let indexReference = 0; indexReference < drawingReferenceResponse.resolvedReferences.length; indexReference++) {
        let resolvedReference: DrawingReference = drawingReferenceResponse.resolvedReferences[indexReference];
        // If the latest element microversion is not the same as the target element microversion, it means
        // the target element has changed since the last time the drawing was updated.
        if (resolvedReference.latestElementMicroversionId !== resolvedReference.targetElementMicroversionId) {
          if (drawingsThatNeedUpdate === null) {
            drawingsThatNeedUpdate = [drawingElementId];
          } else {
            drawingsThatNeedUpdate.push(drawingElementId);
          }
          // Only want each drawingElementId in the array once
          break;
        }
      }
    }
  } catch (error) {
    console.error(error);
    LOG.error('Error getting drawing references.', error);
  }

  return drawingsThatNeedUpdate;
}

/**
 * 
 * @param apiClient - Api Client contains info about session
 * @param documentId - document id
 * @param workspaceOrVersion - 'w' or 'v'
 * @param workspaceOrVersionId - workspace or version id
 * @param elementId - element id
 * @returns 
 */
export async function getDrawingJsonExport(apiClient: ApiClient, documentId: string, workspaceOrVersion: string, workspaceOrVersionId: string, elementId: string): Promise<GetDrawingJsonExportResponse> {
  let exportData: GetDrawingJsonExportResponse = null;
  const storeInDocument: boolean = false;  // In this sample app, we always export the drawing json externally, not to a new element in the document

  try {
    LOG.info('Initiated export of drawing as json');
    let exportResponse: ExportDrawingResponse = await apiClient.post(`api/drawings/d/${documentId}/${workspaceOrVersion}/${workspaceOrVersionId}/e/${elementId}/translations`, {
      formatName: 'DRAWING_JSON',
      storeInDocument: storeInDocument,
      level: 'full'
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

    // resultElementIds will be non-null if storeInDocument parameter is true
    // resultExternalDataIds will be non-null if storeInDocument parameter is false
    if (storeInDocument) {
      // Data stored as a new element in the document.  Return null, although we could retrieve if from the element if needed
      // using the /blobelements/d/{did}/w/{wid}/e/{eid} API, which downloads the contents of a blob element.
      exportData = null;
    } else {
      // Data stored externally - retrieve it
      let translationId: string = translationStatus.resultExternalDataIds[0];
      console.log(`translation id=`, translationId);

      let responseAsString: string = await apiClient.get(`api/documents/d/${documentId}/externaldata/${translationStatus.resultExternalDataIds[0]}`) as string;
      exportData = JSON.parse(responseAsString);
    }

  } catch (error) {
    console.error(error);
    LOG.error('Error getting drawing as json.', error);
  }

  return exportData;
}

export async function waitForModifyToFinish(apiClient: ApiClient, idModifyRequest: string): Promise<ModifyStatusResponseOutput> {

  let succeeded: boolean = true;
  let elapsedSeconds: number = 0;
  let jobOutput: ModifyStatusResponseOutput = null;

  let jobStatus: ModifyJob = { requestState: 'ACTIVE', id: '', output: '' };
  const end = timeSpan();
  while (jobStatus.requestState === 'ACTIVE') {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    elapsedSeconds = end.seconds();

    // If modify takes over 1 minute, then log and continue
    if (elapsedSeconds > 60) {
      succeeded = false;
      LOG.error(`Modify request timed out after ${elapsedSeconds} seconds`);
      break;
    }

    LOG.debug(`Waited for modify seconds=${elapsedSeconds}`);
    jobStatus = await apiClient.get(`api/drawings/modify/status/${idModifyRequest}`) as ModifyJob;
  }

  if (succeeded && jobStatus.requestState !== 'ACTIVE') {
    console.log(`modify status response requestState finished as: ${jobStatus.requestState}`);
    if (jobStatus.requestState === 'DONE') {
      console.log(`modify status response output is: ${jobStatus.output}`);
      // Parse the output string into an object containing the modify results
      jobOutput = JSON.parse(jobStatus.output);
    } else {
      console.log('modify did not finish successfully.');
      jobOutput = null;
    }
  }

  return jobOutput;  // Will return null if failed
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

export function getAnnotationsOfViewAndSheetFromExportData(exportData: GetDrawingJsonExportResponse, view: View2, includeSheetAnnotations: boolean): Annotation[] {
  let annotationsInViewAndSheet: Annotation[] = null;
  let includeAnnotation: boolean = false;

  for (let indexSheet = 0; indexSheet < exportData.sheets.length; indexSheet++) {
    let sheet: Sheet = exportData.sheets[indexSheet];
    if (sheet.name === view.sheet) {
      for (let indexAnnotation = 0; indexAnnotation < sheet.annotations.length; indexAnnotation++) {
        let annotation: Annotation = sheet.annotations[indexAnnotation];
        includeAnnotation = false;
        switch (annotation.type) {
          case DrawingObjectType.CALLOUT: {
            // Look at leader to determine if callout is in a view
            if (annotation.callout.leaderPosition) {
              includeAnnotation = (view.viewId === annotation.callout.leaderPosition.viewId);
            } else {
              includeAnnotation = includeSheetAnnotations;
            }
            break;
          }
          case DrawingObjectType.DIMENSION_DIAMETER: {
            includeAnnotation = (view.viewId === annotation.diametricDimension.chordPoint.viewId);
            break;
          }
          case DrawingObjectType.DIMENSION_LINE_TO_LINE_ANGULAR: {
            includeAnnotation = (view.viewId === annotation.lineToLineAngularDimension.point1.viewId);
            break;
          }
          case DrawingObjectType.DIMENSION_LINE_TO_LINE_LINEAR: {
            includeAnnotation = (view.viewId === annotation.lineToLineDimension.edge1.viewId);
            break;
          }
          case DrawingObjectType.DIMENSION_POINT_TO_LINE_LINEAR: {
            includeAnnotation = (view.viewId === annotation.pointToLineDimension.edge.viewId);
            break;
          }
          case DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR: {
            includeAnnotation = (view.viewId === annotation.pointToPointDimension.point1.viewId);
            break;
          }
          case DrawingObjectType.DIMENSION_RADIAL: {
            includeAnnotation = (view.viewId === annotation.radialDimension.centerPoint.viewId);
            break;
          }
          case DrawingObjectType.DIMENSION_THREE_POINT_ANGULAR: {
            includeAnnotation = (view.viewId === annotation.threePointAngularDimension.point1.viewId);
            break;
          }
          case DrawingObjectType.GEOMETRIC_TOLERANCE: {
            // Look at leader to determine if geometric tolerance is in a view
            if (annotation.geometricTolerance.leaderPosition) {
              includeAnnotation = (view.viewId === annotation.geometricTolerance.leaderPosition.viewId);
            } else {
              includeAnnotation = includeSheetAnnotations;
            }
            break;
          }
          case DrawingObjectType.NOTE: {
            // Look at leader to determine if note is in a view
            if (annotation.note.leaderPosition) {
              includeAnnotation = (view.viewId === annotation.note.leaderPosition.viewId);
            } else {
              includeAnnotation = includeSheetAnnotations;
            }
            break;
          }
          default: {
            includeAnnotation = false;
            break;
          }
        }

        if (includeAnnotation) {
          if (annotationsInViewAndSheet === null) {
            annotationsInViewAndSheet = [annotation];
          } else {
            annotationsInViewAndSheet.push(annotation);
          }
        }
      }
      break;
    }
  }

  return annotationsInViewAndSheet;
}

export function getAllDrawingAnnotationsInViewsFromExportData(exportData: GetDrawingJsonExportResponse): Annotation[] {
  let annotationsInViews: Annotation[] = null;
  let includeAnnotation: boolean = false;

  for (let indexSheet = 0; indexSheet < exportData.sheets.length; indexSheet++) {
    let sheet: Sheet = exportData.sheets[indexSheet];
    for (let indexAnnotation = 0; indexAnnotation < sheet.annotations.length; indexAnnotation++) {
      let annotation: Annotation = sheet.annotations[indexAnnotation];
      includeAnnotation = false;
      switch (annotation.type) {
        case DrawingObjectType.CALLOUT: {
          // Only way to know if a callout is in a view is if it has a leader to an edge of the view
          includeAnnotation = (annotation.callout.leaderPosition && annotation.callout.leaderPosition.viewId) ? true : false;
          break;
        }
        case DrawingObjectType.DIMENSION_DIAMETER: {
          includeAnnotation = annotation.diametricDimension.chordPoint.viewId ? true : false;
          break;
        }
        case DrawingObjectType.DIMENSION_LINE_TO_LINE_ANGULAR: {
          includeAnnotation = annotation.lineToLineAngularDimension.point1.viewId ? true : false;
          break;
        }
        case DrawingObjectType.DIMENSION_LINE_TO_LINE_LINEAR: {
          includeAnnotation = annotation.lineToLineDimension.edge1.viewId ? true : false;
          break;
        }
        case DrawingObjectType.DIMENSION_POINT_TO_LINE_LINEAR: {
          includeAnnotation = annotation.pointToLineDimension.edge.viewId ? true : false;
          break;
        }
        case DrawingObjectType.DIMENSION_POINT_TO_POINT_LINEAR: {
          includeAnnotation = annotation.pointToPointDimension.point1.viewId ? true : false;
          break;
        }
        case DrawingObjectType.DIMENSION_RADIAL: {
          includeAnnotation = annotation.radialDimension.centerPoint.viewId ? true : false;
          break;
        }
        case DrawingObjectType.DIMENSION_THREE_POINT_ANGULAR: {
          includeAnnotation = annotation.threePointAngularDimension.point1.viewId ? true : false;
          break;
        }
        case DrawingObjectType.GEOMETRIC_TOLERANCE: {
          // Only way to know if a geometric tolerance is in a view is if it has a leader to an edge of the view
          includeAnnotation = (annotation.geometricTolerance.leaderPosition && annotation.geometricTolerance.leaderPosition.viewId) ? true : false;
          break;
        }
        case DrawingObjectType.NOTE: {
          // Only way to know if a note is in a view is if it has a leader to an edge of the view
          includeAnnotation = (annotation.note.leaderPosition && annotation.note.leaderPosition.viewId) ? true : false;
          break;
        }
        default: {
          includeAnnotation = false;
          break;
        }
      }

      if (includeAnnotation) {
        if (annotationsInViews === null) {
          annotationsInViews = [annotation];
        } else {
          annotationsInViews.push(annotation);
        }
      }
    }
  }

  return annotationsInViews;
}

export function equalWithinTolerance(value1: number, value2: number, tolerance: number): boolean {
  return ((value1 + tolerance > value2) && (value1 - tolerance < value2));
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

/**
 * Views have their own coordinate system, as does each drawing sheet.
 * This function converts from a view's coordinate system to its sheet coordinate system
 * using the view's view to paper matrix.
 */
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

/**
 * Determine location on a circle at the given angle.
 * Assume Z is constant, meaning the arc is flat in the view.
 */
export function pointOnCircle(centerPoint: number[], radius: number, angleInDegrees: number): number[] {
  let pointToReturn: number[] = null;

  if (centerPoint.length === 3) {
    let angleInRadians: number = (angleInDegrees * Math.PI) / 180.0;
    pointToReturn = [0.0, 0.0, 0.0];
    pointToReturn[0] = centerPoint[0] + radius * Math.cos(angleInRadians);
    pointToReturn[1] = centerPoint[1] + radius * Math.sin(angleInRadians);
    pointToReturn[2] = centerPoint[2];
  }

  return pointToReturn;
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

export function areParallelEdges(edgeOneStartPoint: number[], edgeOneEndPoint: number[],
  edgeTwoStartPoint: number[], edgeTwoEndPoint: number[]): boolean {

  let slopeTolerance = 0.001;
  let verticalTolerance = 0.001;

  let areParallel: boolean = true;

  // First check for vertical lines
  let edgeOneVertical: boolean = equalWithinTolerance(edgeOneEndPoint[1] - edgeOneStartPoint[1], 0.0, verticalTolerance);
  let edgeTwoVertical: boolean = equalWithinTolerance(edgeTwoEndPoint[1] - edgeTwoStartPoint[1], 0.0, verticalTolerance);

  if (edgeOneVertical && edgeTwoVertical) {
    areParallel = true;
  } else if (edgeOneVertical || edgeTwoVertical) {
    areParallel = false;
  } else {
    let slopeOne: number = (edgeOneEndPoint[1] - edgeOneStartPoint[1]) / (edgeOneEndPoint[0] - edgeOneStartPoint[0]);
    let slopeTwo: number = (edgeTwoEndPoint[1] - edgeTwoStartPoint[1]) / (edgeTwoEndPoint[0] - edgeTwoStartPoint[0]);
    areParallel = equalWithinTolerance(slopeOne, slopeTwo, slopeTolerance);
  }

  return areParallel;
}

export function areCoincidentPoints(pointOne: number[], pointTwo: number[]): boolean {
  let distanceTolerance = 0.001;  // Somewhat arbitrary
  let areCoincident: boolean = false;

  if (pointOne.length === 3 && pointTwo.length === 3) {
    areCoincident =
      equalWithinTolerance(pointOne[0], pointTwo[0], distanceTolerance) &&
      equalWithinTolerance(pointOne[1], pointTwo[1], distanceTolerance) &&
      equalWithinTolerance(pointOne[2], pointTwo[2], distanceTolerance);
  }

  return areCoincident;
}