import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { usage, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getIfDrawingNeedsUpdate } from './utils/drawingutils.js';

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
  usage('detect-if-single-drawing-needs-update');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    const drawingNeedsUpdate: boolean = await getIfDrawingNeedsUpdate(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId)

    if (drawingNeedsUpdate) {
      console.log('Drawing needs an update!');
    } else {
      console.log('Drawing does NOT need an update.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Detecting if a drawing needs an update failed', error);
  }
}