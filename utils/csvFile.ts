import { stringify } from 'csv-stringify/sync';
import { promises as fs } from 'fs';
import { FileHandle } from 'fs/promises';
import Path from 'path';
import { FolderType, getFolderPath } from './fileutils.js';
import { BasicNode, Revision } from './onshapetypes.js';

enum CsvType {
  VERSION, REVISION, WEBHOOK_NOTIFICATION, DOCUMENT_REFERENCES, RELEASE_PACAKGE, WORKFLOW, TASK
}

/**
 * For each type of object written to csv, the header rows and column values.
 * The keys are evaluated and optional chaining like "creator?.name" is legal.
 */
const CsvTypeHeaders: Record<CsvType, Record<string, string>> = {
  [CsvType.VERSION]: {
    'Version Id': 'id',
    'Version Name': 'name',
    'Document Id': 'documentId',
    'Description': 'description',
    'Revision': 'revision',
    'Created By': 'creator?.name',
    'Created At': 'createdAt',
    'Parent Version': 'parent',
    'Microversion': 'microversion',
  },
  [CsvType.REVISION]: {
    'Revision Id': 'id',
    'Part Number': 'partNumber',
    'Revision': 'revision',
    'Released By': 'releasedBy?.name',
    'Company Id': 'companyId',
    'Document Id': 'documentId',
    'Document Name': 'documentName',
    'Version Id': 'versionId',
    'Version Name': 'versionName',
    'Element Id': 'elementId',
    'Part Id': 'partId',
    'Element Type': 'elementType',
    'Configuration': 'configuration',
    'Mime Type': 'mimeType',
    'Created At': 'createdAt',
    'ViewRef': 'viewRef',
  },
  [CsvType.RELEASE_PACAKGE]: {
    'Package Id': 'id',
    'Package Name': 'name',
    'Document Id': 'documentId',
    'Item Count': 'items?.length',
    'Version Id': 'versionId',
    'Is Obsoletion': 'workflow?.isObsoletion',
    'Is Frozen': 'workflow?.isFrozen',
    'Description': 'description',
    'Workflow State': 'workflow?.state?.name',
    'Metadata State': 'workflow?.metadataState',
    'Created At': 'createdAt',
    'Created By': 'createdBy?.name',
    'Modified At': 'modifiedAt',
    'Modified By': 'modifiedBy?.name',
  },
  [CsvType.WEBHOOK_NOTIFICATION]: {
    'Json Type': 'jsonType',
    'Event Name': 'event',
    'Message Id': 'messageId',
    'Webhook Id': 'webhookId',
    'Data': 'data',
    'Time': 'timestamp',
    'Document Id': 'documentId',
    'User Id': 'userId',
    'Version Id': 'versionId',
    'Element Id': 'elementId',
    'Revision Id': 'revisionId',
    'Part Number': 'partNumber',
    'Translation Id': 'translationId',
    'Workflow Object Id': 'objectId',
    'Transition Name': 'transitionName',
  },
  [CsvType.DOCUMENT_REFERENCES]: {
    'Document Id': 'id',
    'Document Name': 'name',
    'Description': 'description',
    'Folder Id': 'folderId',
    'Folder Name': 'folderName',
    'Outside': 'outSide',
    'Owner Id': 'docOwnerId',
    'Owner Name': 'docOwnerName',
    'Created By': 'docCreator',
    'Modified By': 'docModifier',
  },
  [CsvType.WORKFLOW]: {
    'Object Id': 'id',
    'Object Name': 'name',
    'Object Type': 'objectType',
    'State': 'stateId',
    'Metadata State': 'metadataState',
    'Can Be Discarded': 'canBeDiscarded',
    'Is Discarded': 'isDiscarded',
    'Is Frozen': 'isFrozen',
    'Api Ref': 'href',
  },
  [CsvType.TASK]: {
    'Task Id': 'id',
    'Task Type': 'taskType',
    'Task Name': 'name',
    'Description': 'description',
    'Editable': 'editable',
    'User Count': 'users?.length',
    'Item Count': 'taskItems?.length',
    'Resolved By': 'resolvedBy?.name',
    'Resolved At': 'resolvedAt',
  },
};

/**
 * A utility class to create a csv file for a input script for objects like revisions and versions
 */
class CsvFileWriter {
  private readonly type: CsvType;
  private fileHandle: FileHandle;
  private filePath;

  public constructor(type: CsvType, fileName: string) {
    this.type = type;
    this.filePath = Path.join(getFolderPath(FolderType.REPORTS), fileName);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async writeObject(anObject: unknown) {
    if (!this.fileHandle) {
      this.fileHandle = await fs.open(this.filePath, 'w');
      await this.flushToFile(Object.keys(CsvTypeHeaders[this.type]));
    }

    const lines = [];
    for (const keyValue of Object.values(CsvTypeHeaders[this.type])) {
      const expressToEval = `anObject.${keyValue}`;
      const cell = eval(expressToEval) ?? '';
      lines.push(cell.toString());
    }
    await this.flushToFile(lines);
  }

  private async flushToFile(lines: unknown[]) {
    const csvLine = stringify([lines]);
    await fs.writeFile(this.fileHandle, csvLine);
    await this.fileHandle.datasync();
  }
}

const OUTPUT_FOLDER = getFolderPath(FolderType.OUTPUT);

const writers: Record<CsvType, CsvFileWriter> = {
  [CsvType.VERSION]: new CsvFileWriter(CsvType.VERSION, 'versions.csv'),
  [CsvType.REVISION]: new CsvFileWriter(CsvType.REVISION, 'revisions.csv'),
  [CsvType.WEBHOOK_NOTIFICATION]: new CsvFileWriter(CsvType.WEBHOOK_NOTIFICATION, 'notifications.csv'),
  [CsvType.DOCUMENT_REFERENCES]: new CsvFileWriter(CsvType.DOCUMENT_REFERENCES, 'references.csv'),
  [CsvType.RELEASE_PACAKGE]: new CsvFileWriter(CsvType.RELEASE_PACAKGE, 'release_packages.csv'),
  [CsvType.WORKFLOW]: new CsvFileWriter(CsvType.WORKFLOW, 'workflow_objects.csv'),
  [CsvType.TASK]: new CsvFileWriter(CsvType.WORKFLOW, 'tasks.csv'),
};

export async function writeRevision(rev: Revision) {
  const fileName = `${OUTPUT_FOLDER}/revision_${rev.id}.json`;
  await fs.writeFile(fileName, JSON.stringify(rev, null, 2));
  await writers[CsvType.REVISION].writeObject(rev);
}

export async function writeWorkflowObject(wfObject: BasicNode) {
  const fileName = `${OUTPUT_FOLDER}/workflow_object_${wfObject.id}.json`;
  await fs.writeFile(fileName, JSON.stringify(wfObject, null, 2));
  await writers[CsvType.WORKFLOW].writeObject(wfObject);
}

export async function writeVersion(version: BasicNode) {
  const fileName = `${OUTPUT_FOLDER}/version_${version.id}.json`;
  await fs.writeFile(fileName, JSON.stringify(version, null, 2));
  await writers[CsvType.VERSION].writeObject(version);
}

export async function writeReleasePackage(releasePackage: BasicNode) {
  const fileName = `${OUTPUT_FOLDER}/release_package_${releasePackage.id}.json`;
  await fs.writeFile(fileName, JSON.stringify(releasePackage, null, 2));
  await writers[CsvType.RELEASE_PACAKGE].writeObject(releasePackage);
}

export async function writeTask(task: BasicNode) {
  const fileName = `${OUTPUT_FOLDER}/task_${task.id}.json`;
  await fs.writeFile(fileName, JSON.stringify(task, null, 2));
  await writers[CsvType.TASK].writeObject(task);
}

export async function writeNotification(webhookEvent: {messageId: string}) {
  const fileName = `${OUTPUT_FOLDER}/notification_${webhookEvent.messageId}.json`;
  await fs.writeFile(fileName, JSON.stringify(webhookEvent, null, 2));
  await writers[CsvType.WEBHOOK_NOTIFICATION].writeObject(webhookEvent);
}

export async function writeDocumentReferences(docRefs: unknown) {
  await writers[CsvType.DOCUMENT_REFERENCES].writeObject(docRefs);
}
