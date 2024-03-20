import Path from 'path';
import { mkdirp } from 'mkdirp';

export enum FolderType {
  OUTPUT, REPORTS, EXPORTS
}

/**
 * For input script webhook.ts, the log name is webhook
 */
export function getLogName() {
  const logFileName = Path.parse(process.argv[1] || 'main').name;
  return logFileName;
}

/**
 * For input script webhook.ts, the log filename is ./logs/webhook.log
 */
export function getLogFilePath() {
  const logFolder = './logs';
  mkdirp.sync(logFolder);
  return Path.join(logFolder, `${getLogName()}.log`);
}

/**
 * For input script webhook.ts
 *    csvs go into ./reports/webhook/
 *    step/pdf go into ./exports/webhook/
 *    json object dumps go into ./output/webhook/
 */
export function getFolderPath(type: FolderType) {
  let folder = null;
  switch (type) {
  case FolderType.OUTPUT:
    folder = './output';
    break;
  case FolderType.REPORTS:
    folder = './reports';
    break;
  case FolderType.EXPORTS:
    folder = './exports';
    break;
  default:
    throw new Error('Unhandled FolderType');
  }

  folder = Path.resolve(folder, getLogName());
  mkdirp.sync(folder);
  return folder;
}
