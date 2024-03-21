import { BasicNode } from './onshapetypes.js';
import { mainLog } from './logger.js';
import { ArgumentParser } from './argumentparser.js';

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

  const LOG = mainLog();

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
