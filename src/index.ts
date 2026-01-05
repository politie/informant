export { deprecated, trace } from './decorators.js';
export { BaseError, errorForEach, errorFromList, errorInfo, findCauseByName, fullStack, hasCauseWithName, InfoObject } from './errors.js';
export { Logger, LogMethod } from './logger.js';
export {
    async, captureLogging, consoleHandler, forLogger, fromLevel, LogHandler,
    registerLogHandler, RingBuffer, ringBuffer, unregisterLogHandler,
} from './loghandler.js';
export { levels, logEverything, LogLevel, LogLevelName, logNothing } from './loglevel.js';
export { LogRecord } from './logrecord.js';

// tslint:disable-next-line
declare global {
    // tslint:disable-next-line:variable-name
    var _politie_informant_loaded_: boolean;
}

// do not warn in mocha hot-reloading environment
if ((typeof globalThis.it !== 'function' || typeof globalThis.describe !== 'function') && globalThis._politie_informant_loaded_) {
    // tslint:disable-next-line:no-console
    console.error('@politie/informant already loaded, check for duplicate installs of library!');
}
globalThis._politie_informant_loaded_ = true;
