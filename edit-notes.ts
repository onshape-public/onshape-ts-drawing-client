import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode, DrawingObjectType, Note, GetDrawingJsonExportResponse, Annotation, ModifyStatusResponseOutput, SingleRequestResultStatus } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs } from './utils/drawingutils.js';
import { getDrawingJsonExport, getAllDrawingAnnotationsInViewsFromExportData } from './utils/drawingutils.js';

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
  usage('edit-notes');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    /**
     * Retrieve annotations in the drawing that are associated with views (to avoid annotations in borders, titleblock, etc.).
     * NOTE - THIS MEANS NOTES THAT ARE NOT ASSOCIATED WITH A VIEW (e.g. do not have a leader attached to a view edge) WILL NOT BE EDITED.
     */
    let drawingJsonExport: GetDrawingJsonExportResponse = await getDrawingJsonExport(apiClient, drawingScriptArgs.documentId, 'w', drawingScriptArgs.workspaceId, drawingScriptArgs.elementId) as GetDrawingJsonExportResponse;
    let viewAnnotations: Annotation[] = getAllDrawingAnnotationsInViewsFromExportData(drawingJsonExport);

    /**
     * Loop through annotations and create edit requests to move each note 1 unit to the right and add ' +' to the last line of note text.
     */
    let editAnnotations: Annotation[] = null;
    for (let indexAnnotation = 0; indexAnnotation < viewAnnotations.length; indexAnnotation++) {
      let annotation: Annotation = viewAnnotations[indexAnnotation];
      let editAnnotation: Annotation = null;

      switch (annotation.type) {
        case DrawingObjectType.NOTE: {
          // Add a ' +' at the end of the note text.
          // It's best to preserve the {\\pxql; <note text> } structure of note text by putting new text inside of the {}'s.
          // pxql or pql is left justified, pxqc or pqc is center justified, pxqr or pqr is right justified, pxqj or pqj is justified.
          let lastBraceRegEx = /}$/g;  // Regular expression to find the brace at end of the contents string
          let newContents = annotation.note.contents.replace(lastBraceRegEx, ' +}')

          editAnnotation = {
            note: {
              logicalId: annotation.note.logicalId,
              position: {
                coordinate: [
                  annotation.note.position.coordinate[0] + 1.0,
                  annotation.note.position.coordinate[1],
                  annotation.note.position.coordinate[2]
                ],
                type: 'Onshape::Reference::Point'
              },
              contents: newContents
            },
            type: DrawingObjectType.NOTE
          };
          break;
        }
        default: {
          editAnnotation = null;
          break;
        }
      }

      if (editAnnotation) {
        if (editAnnotations === null) {
          editAnnotations = [editAnnotation];
        } else {
          editAnnotations.push(editAnnotation);
        }
      }
    }
  
    if (editAnnotations && editAnnotations.length > 0) {
      const requestBody = {
        description: 'Edit notes',
        jsonRequests: [ {
          messageName: 'onshapeEditAnnotations',
          formatVersion: '2021-01-01',
          annotations: editAnnotations
        } ]
      };

      /**
       * Modify the drawing to edit the dimensions
       */
      const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`, requestBody) as BasicNode;
  
      const responseOutput: ModifyStatusResponseOutput = await waitForModifyToFinish(apiClient, modifyRequest.id);
      if (responseOutput) {
        let countSucceeded = 0;
        let countFailed = 0;
        for (let iResultCount: number = 0; iResultCount < responseOutput.results.length; iResultCount++) {
          let currentResult = responseOutput.results[iResultCount];
          if (currentResult.status === SingleRequestResultStatus.RequestSuccess) {
            countSucceeded++;
          } else {
            countFailed++;
          }
        }
        console.log(`Successfully edited ${countSucceeded} of ${editAnnotations.length} notes.`);
        if (countFailed > 0) {
          console.log(`Failed to edit ${countFailed} notes.`);
        }
        if (editAnnotations.length !== (countSucceeded + countFailed)) {
          let countTotal = countSucceeded + countFailed;
          console.log(`Mismatch in number of note edits requested (${editAnnotations.length}) and response (${countTotal}).`);
        }
      } else {
        console.log('Edit notes failed waiting for modify to finish.');
        LOG.info('Edit notes failed waiting for modify to finish.');
      }
    } else {
      console.log('No notes found to be edited.');
      LOG.error('No notes found to be edited.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Edit notes failed', error);
  }
}