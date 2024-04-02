import timeSpan from 'time-span';
import { mainLog } from './logger.js';
import { ArgumentParser } from './argumentparser.js';
import { ApiClient } from './apiclient.js';
import { BasicNode, GetDrawingViewsResponse, Edge, ExportDrawingResponse, GetViewJsonGeometryResponse, GetDrawingJsonExportResponse, Sheet, TranslationStatusResponse, View2 } from './onshapetypes.js';

const LOG = mainLog();

export function usage(scriptName: string) {
  console.error(`Usage: npm run ${scriptName} --documenturi=Xxx [--stack=Yyy]`);
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

  const documentUri: string = ArgumentParser.get('documenturi');
  if (!documentUri) {
    throw new Error('Please specify --documenturi=Xxx as an argument');
  }

  let drawingScriptArgs: DrawingScriptArgs = {
    stackToUse: ArgumentParser.get('stack'),
    documentId: '',
    workspaceId: '',
    elementId: ''
  };

  LOG.info(`Processing docuri=${documentUri}`);
  let url: URL = null;
  try {
    url = new URL(documentUri);
  } catch (error) {
    throw new Error(`Failed to parse ${documentUri} as valid URL`);
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

export function getRandomLocation(): number[] {
  // Position of note is random between (0.0, 0.0) and (10.0, 10.0)
  const xPosition: number = Math.random() * 10.0;
  const yPosition: number = Math.random() * 10.0;
  return [xPosition, yPosition, 0.0];
}

export function getRandomInt(min: number, max: number) {
  // Return integer between lowerInt and upperInt inclusive
  let randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomInt;
}

export async function getIdOfRandomViewOnActiveSheet(apiClient: ApiClient, documentId: string, workspaceId: string, elementId: string): Promise<View2> {
  let viewToReturn: View2 = null;

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
    let exportData: GetDrawingJsonExportResponse = JSON.parse(responseAsString);

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
  } catch (error) {
    console.error(error);
    LOG.error('Error getting drawing as json.', error);
  }

  return viewToReturn;
}

/**
 * Return if the given arc axis is perpendicular to the view plane, which would mean
 * it is acceptable to place a radial or diametric dimension on it.
 */
export function isArcAxisPerpendicularToViewPlane(axisDir: number[]): boolean {
  /**
   * Arc should have an axis pointing out of the view - approximately (0, 0, 1).
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

export function convertPointViewToPaper(pointInView: number[], xViewPosition: number, yViewPosition: number, viewToPaperMatrix: number[]): number[] {
  let pointInPaper: number[] = null;

  if (pointInView.length === 3 && viewToPaperMatrix.length === 12) {
    pointInPaper = [0.0, 0.0, 0.0];
    pointInPaper[0] = xViewPosition + viewToPaperMatrix[0] * pointInView[0] + viewToPaperMatrix[1] * pointInView[1] + viewToPaperMatrix[2] * pointInView[2];
    pointInPaper[1] = yViewPosition + viewToPaperMatrix[4] * pointInView[0] + viewToPaperMatrix[5] * pointInView[1] + viewToPaperMatrix[6] * pointInView[2];
    pointInPaper[2] = viewToPaperMatrix[8] * pointInView[0] + viewToPaperMatrix[9] * pointInView[1] + viewToPaperMatrix[10] * pointInView[2];
  }

  return pointInPaper;
}

