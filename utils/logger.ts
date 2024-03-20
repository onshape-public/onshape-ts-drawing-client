import pkg, { Logger } from 'log4js';
import { getLogName, getLogFilePath } from './fileutils.js';

const { configure, getLogger } = pkg;

const logName = getLogName();

/**
 * For input script webhook.ts, the log filename is ./logs/webhook.log
 * INFO or above goes both to stdout and webhook.log.... DEBUG/TRACE only go to the log file
 */
configure({
  appenders: {
    everything: { type: 'stdout' },
    main: { type: 'file', filename: getLogFilePath(), flags: 'w' },
    infofilter: { type: 'logLevelFilter', appender: 'everything', level: 'info' }
  },
  categories: { default: { appenders: ['main', 'infofilter'], level: 'all' } }
});

export const LOG = getLogger(logName);

export function mainLog(): Logger {
  return LOG;
}

