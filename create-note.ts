import { mainLog } from './utils/logger.js';
import { ArgumentParser } from './utils/argumentparser.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode } from './utils/onshapetypes.js';

const LOG = mainLog();

function usage() {
  console.error("Usage: npm run create-note --documenturi=Xxx --notetext=Xxx [--stack=Xxx]");
}

try {
  const documentUri: string = ArgumentParser.get('documenturi');
  let noteText: string = ArgumentParser.get('notetext');
  let stackToUse: string = ArgumentParser.get('stack');
  if (!documentUri) {
    throw new Error('Please specify --documenturi=XXX as argument');
  }
  if (!noteText) {
    throw new Error('Please specify --notetext=XXX as argument');
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

  LOG.info(`documentId=${documentId}, workspaceId=${workspaceId}, elementId=${elementId}`);

  const apiClient = await ApiClient.createApiClient(stackToUse);

  try {
    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${documentId}/w/${workspaceId}/e/${elementId}/modify`,  {
      description: "Add a note to drawing",
      jsonRequests: [ {
        messageName: 'onshapeCreateAnnotations',
        formatVersion: '2021-01-01',
        annotations: [
          {
            type: 'Onshape::Note',
            note: {
              position: {
                type: 'Onshape::Reference::Point',
                coordinate: [ 3.0, 3.0, 0.0 ]
              },
              contents: noteText,
              textHeight: 0.12
            }
          }
        ]
      }]
    }) as BasicNode;
  } catch (error) {
    console.error(error);
    LOG.error('Create note failed', error);
  }

} catch (error) {
  usage();
  console.error(error);
  LOG.error('Create note failed', error);
}
