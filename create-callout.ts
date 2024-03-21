import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ArgumentParser } from './utils/argumentparser.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode } from './utils/onshapetypes.js';

const LOG = mainLog();

function usage() {
  console.error("Usage: npm run create-callout --documenturi=Xxx [--stack=Xxx]");
}

try {
  const documentUri: string = ArgumentParser.get('documenturi');
  let stackToUse: string = ArgumentParser.get('stack');
  if (!documentUri) {
    throw new Error('Please specify --documenturi=XXX as argument');
  }

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

  const documentId: string = regexMatch[1];
  const wv: string = regexMatch[2];
  if (wv != 'w') {
    throw new Error('--documenturi must specify a drawing in a workspace');
  }
  const workspaceId: string = regexMatch[3];
  const elementId: string = regexMatch[4];

  // Position of annotation is random between (0.0, 0.0) and (10.0, 10.0)
  const xPosition: number = Math.random() * 10.0;
  const yPosition: number = Math.random() * 10.0;
  const textHeight = 0.12;
  const annotationText = "Callout at x: " + xPosition + "y: " + yPosition;

  LOG.info(`documentId=${documentId}, workspaceId=${workspaceId}, elementId=${elementId}`);

  const apiClient = await ApiClient.createApiClient(stackToUse);

  /**
   * The typical response of modify POST request
   */
  interface ModifyJob extends BasicNode {
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
   * Modify the drawing to create a callout
   */
  try {
    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${documentId}/w/${workspaceId}/e/${elementId}/modify`,  {
      description: "Add a callout to drawing",
      jsonRequests: [ {
        messageName: 'onshapeCreateAnnotations',
        formatVersion: '2021-01-01',
        annotations: [
          {
            type: 'Onshape::Callout',
            callout: {
              borderShape: 'Circle',
              borderSize: 0,
              contents: annotationText,
              contentsBottom: 'bottom',
              contentsLeft: 'left',
              contentsRight: 'right',
              contentsTop: 'top',
              position: {
                type: 'Onshape::Reference::Point',
                coordinate: [ xPosition, yPosition, 0.0 ]
              },
              textHeight: textHeight
            }
          }
        ]
      }]
    }) as BasicNode;

    LOG.info('Initiated creation of callout in drawing', modifyRequest);
    let jobStatus: ModifyJob = { requestState: 'ACTIVE', id: '' };
    const end = timeSpan();
    while (jobStatus.requestState === 'ACTIVE') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const elapsedSeconds = end.seconds();

      // If modify takes over 1 minute, then log and continue
      if (elapsedSeconds > 60) {
        LOG.error(`Callout creation timed out after ${elapsedSeconds} seconds`);
        break;
      }

      LOG.debug(`Waited for modify seconds=${elapsedSeconds}`);
      jobStatus = await apiClient.get(`api/drawings/modify/status/${modifyRequest.id}`) as ModifyJob;
    }

    LOG.info(`Created ${annotationText}`);

  } catch (error) {
    console.error(error);
    LOG.error('Create callout failed', error);
  }

} catch (error) {
  usage();
  console.error(error);
  LOG.error('Create callout failed', error);
}
