import { Logger } from './logger.js';
import { LogLevel } from './loglevel.js';

export function resetLoggers() {
    const root = Logger.get('');
    for (const child of Object.keys(root.childLoggers)) {
        delete root.childLoggers[child];
    }
    root.level = LogLevel.info;
}
