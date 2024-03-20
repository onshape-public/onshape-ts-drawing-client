import sanitize from 'sanitize-filename';
import timeSpan from 'time-span';
import { promises as fs } from 'fs';
import { ApiClient } from './apiclient.js';
import { FolderType, getFolderPath } from './fileutils.js';
import { mainLog } from './logger.js';
import { BasicNode, Revision } from './onshapetypes.js';
const LOG = mainLog();

/**
 * The typical response of translation POST request
 */
interface TranslationJob extends BasicNode {
  /** Current completion status of translation job */
  requestState: 'ACTIVE' | 'DONE' | 'FAILED';
  /** The document that contains the element or part to be translated */
  documentId?: string;
  /** The element that contains part or itself to be translated */
  requestElementId?: string;
  /** The foreign data like PDF/step that can be downloaded once translation is finished */
  resultExternalDataIds?: string[];
  /** Reason why the translation failed if not DONE */
  failureReason?: string;
}

/**
 * Illustrates invoking a translation and downloading the result
 */
export class TranslationHelper {
  readonly apiClient: ApiClient = null;
  readonly translationIdToFilePath = new Map<string, string>();

  public constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /** Invoke a Drawing PDF translation and wait for webhook event onshape.model.translation.complete to download it  */
  public async exportDrawingRevision(rev: Revision) {
    const documentId = rev.documentId;
    const filenameNoExt = sanitize(`${rev.partNumber}_${rev.revision}`);
    const outputFileName = `${filenameNoExt}.pdf`;
    const pdfOutput = getFolderPath(FolderType.EXPORTS) + '/' + outputFileName;


    // Initiate drawing to PDF translation
    const translationReq = await this.apiClient.post(`api/drawings/d/${documentId}/v/${rev.versionId}/e/${rev.elementId}/translations`, {
      formatName: 'PDF',
      storeInDocument: false,
      showOverriddenDimensions: true,
      destinationName: outputFileName
    }) as BasicNode;

    this.translationIdToFilePath.set(translationReq.id, pdfOutput);
    LOG.info('Initiated Drawing translationReq', translationReq);
  }

  /** Invoke a GTLF translation, Unlike other exports this returns the response instead of creating a translation job */
  public async exportAssemblyRevision(rev: Revision) {
    const documentId = rev.documentId;
    const filenameNoExt = sanitize(`${rev.partNumber}_${rev.revision}`);
    const outputFileName = `${filenameNoExt}.gltf`;
    const gltOutput = getFolderPath(FolderType.EXPORTS) + '/' + outputFileName;

    // gtlf is requested with a Accept Header of either model/gltf-binary or model/gltf+json
    const acceptHeader = 'model/gltf+json';
    const gltfResponse = await this.apiClient.get(`api/assemblies/d/${documentId}/v/${rev.versionId}/e/${rev.elementId}/gltf`, acceptHeader);
    await fs.writeFile(gltOutput, JSON.stringify(gltfResponse, null, 2));
  }

  /** Invoke a Part STEP translation and poll its status periodically until DONE to download it */
  public async exportPartRevisionSync(rev: Revision) {
    const documentId = rev.documentId;
    const filenameNoExt = sanitize(`${rev.partNumber}_${rev.revision}`);
    const outputFileName = `${filenameNoExt}.step`;
    const stepOutput = getFolderPath(FolderType.EXPORTS) + '/' + outputFileName;


    // Initiate a request to translate part to step format. This gives href that you can poll to see if the translation has completed
    const translationReq = await this.apiClient.post(`api/partstudios/d/${documentId}/v/${rev.versionId}/e/${rev.elementId}/translations`, {
      formatName: 'STEP',
      partIds: rev.partId,
      configuration: rev.configuration,
      storeInDocument: false,
      destinationName: outputFileName
    }) as BasicNode;

    LOG.info('Initiated Part STEP translationReq', translationReq);
    let jobStatus: TranslationJob = { requestState: 'ACTIVE', id: '' };
    // Wait until the step export has finished
    const end = timeSpan();
    while (jobStatus.requestState === 'ACTIVE') {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const elaspedSeconds = end.seconds();

      // If export takes over 10 minutes log and continue
      if (elaspedSeconds > 600) {
        LOG.error(`Part Step for ${filenameNoExt} Timed out after ${elaspedSeconds} seconds`);
        return;
      }

      LOG.debug(`Waited for translation ${outputFileName} seconds=${elaspedSeconds} for ${outputFileName}`);
      jobStatus = await this.apiClient.get(translationReq.href) as TranslationJob;
    }

    await this.downloadCompletedFile(jobStatus, stepOutput);
  }

  /** Called to webhook notification when translation is done or failed */
  public async downloadTranslation(translationId: string) {
    const filePath = this.translationIdToFilePath.get(translationId);
    // No record of this translation so most likely not initiated by this application
    if (!filePath) {
      return;
    }

    const completedTranslation = await this.apiClient.get(`api/translations/${translationId}`) as TranslationJob;
    await this.downloadCompletedFile(completedTranslation, filePath);
  }

  private async downloadCompletedFile(completedTranslation: TranslationJob, filePath: string) {
    LOG.debug('Completed Translation status', completedTranslation);
    const externalId = completedTranslation.resultExternalDataIds?.[0];
    const documentId = completedTranslation.documentId;
    if (documentId && externalId && completedTranslation.requestState === 'DONE') {
      await this.apiClient.downloadFile(`api/documents/d/${documentId}/externaldata/${externalId}`, filePath);
    } else {
      LOG.error('Bad translation completion status', completedTranslation);
    }
  }
}
