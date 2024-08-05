import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { GetDrawingJsonExportResponse, Sheet } from './utils/onshapetypes.js';
import { usage, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport } from './utils/drawingutils.js';

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
  usage('find-errors-in-drawing');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    /**
     * Do a drawing export to get the views and annotations in the drawing
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    
    
    for (let indexSheet = 0; indexSheet < drawingJsonExport.sheets.length; indexSheet++) {
      let sheet: Sheet = drawingJsonExport.sheets[indexSheet];

      // Check for views on the sheet that have a bad error state
      for (let indexView = 0; indexView < sheet.views.length; indexView++) {
        // Uncommment when we can see the errorState field on views in json exports
        // aView = sheet.views[indexView];
        // if (aView.errorState != 0) {
        //   console.log("some error message");
        // }
      }

      // Check for annotations on the sheet that are dangling
      // TBD
    }
  
  } catch (error) {
    console.error(error);
    LOG.error('Find errors in drawing failed: ', error);
  }
}