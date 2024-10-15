import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { usage, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getWorkspaceDrawingsThatNeedUpdate } from './utils/drawingutils.js';

const LOG = mainLog();

let drawingScriptArgs: DrawingScriptArgs = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;

try {
  // Note that we do not use the elementId in this script, but chose to use the "drawingUri" argument anyways, for consistency
  drawingScriptArgs = parseDrawingScriptArgs();
  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  validateBaseURLs(apiClient.getBaseURL(), drawingScriptArgs.baseURL);
} catch (error) {
  validArgs = false;
  usage('detect-if-workspace-contains-drawings-needing-update');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    const drawingsThatNeedUpdate: string[] = await getWorkspaceDrawingsThatNeedUpdate(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId)

    if (drawingsThatNeedUpdate && drawingsThatNeedUpdate.length > 0) {
      console.log(`Workspace contains ${drawingsThatNeedUpdate.length} drawing(s) that need an update!`);
    } else {
      console.log('Workspace does NOT contain any drawings that need an update.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Detecting if a workspace contains drawings that need an update failed', error);
  }
}