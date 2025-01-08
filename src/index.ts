export { deprecated, trace } from './decorators';
export { BaseError, errorForEach, errorFromList, errorInfo, findCauseByName, fullStack, hasCauseWithName, InfoObject } from './errors';
export { Logger, LogMethod } from './logger';
export {
    async, captureLogging, consoleHandler, forLogger, fromLevel, LogHandler,
    registerLogHandler, RingBuffer, ringBuffer, unregisterLogHandler,
} from './loghandler';
export { levels, logEverything, LogLevel, LogLevelName, logNothing } from './loglevel';
export { LogRecord } from './logrecord';

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
