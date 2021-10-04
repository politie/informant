import { LogLevel } from './loglevel';
import { LogRecord } from './logrecord';

/**
 * A registered LogHandler simply receives all LogRecords, it should not change the record and not throw Errors.
 *
 * @see registerLogHandler
 */
export type LogHandler = (record: LogRecord) => void;

/** All currently registered LogHandlers. */
export const logHandlers: LogHandler[] = [];

/** Register a log handler. */
export function registerLogHandler(logHandler: LogHandler) {
    if (logHandlers.indexOf(logHandler) < 0) {
        logHandlers.push(logHandler);
    }
}

/** Unregister a log handler. */
export function unregisterLogHandler(logHandler: LogHandler) {
    const i = logHandlers.indexOf(logHandler);
    if (i >= 0) {
        logHandlers.splice(i, 1);
    }
}

/**
 * Temporarily removes all LogHandlers and records all messages into an array of LogRecords. Call restore()
 * after use to restore the previous loghandlers.
 */
export function captureLogging() {
    const records: LogRecord[] = [];
    const handler: LogHandler = r => records.push(r);
    const oldHandlers = logHandlers.slice();
    const restore = () => { unregisterLogHandler(handler); oldHandlers.forEach(registerLogHandler); };
    logHandlers[0] = handler;
    logHandlers.length = 1;
    return { records, restore };
}

/**
 * Ensures the provided handler only receives records for the given level or above.
 */
export function fromLevel(level: LogLevel, handler: LogHandler): LogHandler {
    return record => record.level >= level && handler(record);
}

/**
 * Ensures the provided handler only receives records for:
 *  * the logger with the given name or any of its children, if provided with a string
 * OR
 *  * the logger(s) matching the given regular expression
 */
export function forLogger(name: string | RegExp, handler: LogHandler): LogHandler {
    if (typeof name === 'string') {
        return record => (record.logger === name || record.logger.startsWith(name + '.')) && handler(record);
    } else {
        return record => name.test(record.logger) && handler(record);
    }
}

/**
 * Wraps the given handler s.t. the handler is called asynchronously in a future tick.
 */
export function async(handler: LogHandler): LogHandler {
    return record => setTimeout(handler, 0, record);
}

/**
 * A basic JavaScript-console handler.
 */
export function consoleHandler(record: LogRecord) {
    const { level } = record;
    // tslint:disable:no-console
    if (level >= LogLevel.error) { return log(console.error, record); }
    if (level >= LogLevel.warning) { return log(console.warn, record); }
    if (level >= LogLevel.info) { return log(console.info, record); }
    log(console.log, record);
    // tslint:enable:no-console
}

function log(method: typeof console.log, record: LogRecord) {
    const msg = `[${record.time.toISOString()}]\t${String(LogLevel[record.level]).toUpperCase()}\t${record.logger}: ${record.message}`;
    if (record.details) {
        method.call(console, msg + ', details:', record.details);
    } else {
        method.call(console, msg);
    }
}

/**
 * A RingBuffer implementation that can be used to fetch the last X records on error or while debugging.
 *
 * @param maxSize the maximum size to which the ringBuffer is allowed to grow
 */
export function ringBuffer<V = LogRecord>(maxSize = 100): RingBuffer<V> {
    const array: V[] = new Array(maxSize);
    let size = 0;
    let next = 0;

    function handle(record: V) {
        array[next] = record;
        next = (next + 1) % maxSize;
        if (size < maxSize) { size++; }
    }

    function get() {
        if (size < maxSize) {
            return array.slice(0, next);
        } else {
            return [...array.slice(next), ...array.slice(0, next)];
        }
    }

    return Object.defineProperties(handle, {
        size: { get() { return size; } },
        get: { value: get },
    }) as RingBuffer<V>;
}

export interface RingBuffer<V> extends LogHandler {
    (v: V): void;
    readonly size: number;
    get(): V[];
}
