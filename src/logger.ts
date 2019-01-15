import { errorInfo, fullStack } from './errors';
import { consoleHandler, logHandlers } from './loghandler';
import { levels, LogLevel, LogLevelName } from './loglevel';
import { LogRecord } from './logrecord';

/**
 * Logger should be used to log messages and data. An instance of Logger can be scoped to a specific domain or component.
 */
export class Logger {
    /**
     * Get the Logger with the specified name. Names with dots (`.`) can be used to get or create hierarchical loggers.
     */
    static get(path: string) {
        return Logger.root.childLogger(path);
    }

    private static readonly root = new Logger('', LogLevel.info);

    private constructor(
        /** The name of the logger, this name can be used to get the correct Logger instance and will be present in all LogRecords. */
        readonly name: string,
        /** The current level of this logger. Only messages of this level and higher are logged. */
        public level: LogLevel,
    ) { }

    /**
     * A map of all direct child Loggers.
     */
    readonly childLoggers: { [name: string]: Logger } = {};

    /**
     * Get or create the child logger with the specified name or path. A string with dots in it (`.`) is interpreted as a
     * name path and can be used to fetch a grandchild.
     */
    childLogger(path: string | string[]): Logger {
        if (path === '') {
            return this;
        }
        if (!Array.isArray(path)) {
            path = path.split('.');
        }
        if (path.length === 0) {
            return this;
        }
        const name = path[0];
        if (!name) {
            throw new Error('Invalid empty logger name');
        }
        const child = this.childLoggers[name] ||
            (this.childLoggers[name] = new Logger(`${this.name}${this.name && '.'}${name}`, this.level));
        return child.childLogger(path.slice(1));
    }

    /**
     * Set the LogLevel of this Logger and all of its recursive children to the provided level.
     */
    setChildLoggersLevel(level: LogLevel) {
        this.level = level;
        for (const name of Object.keys(this.childLoggers)) {
            this.childLoggers[name].setChildLoggersLevel(level);
        }
        return this;
    }

    /**
     * Wrap the given function to trace all calls to the method and logs both the entry and exit from the method, only if LogLevel.trace
     * is enabled for this logger.
     *
     * @param name the name under which to log the traces
     * @param func the function to wrap
     */
    traceWrap<T extends (...args: any[]) => any>(name: string, func: T): T {
        const logger = this;

        function maybeTraced(this: any) {
            return logger.trace() ? traced.apply(this, arguments as any) : func.apply(this, arguments as any);
        }

        function traced(this: any, ...args: any[]) {
            logger.trace(`${name}(${args.map(simpleInspect).join(', ')})`);
            try {
                const result = func.apply(this, args);
                logger.trace('RETURNS', simpleInspect(result));
                return result;
            } catch (e) {
                logger.trace(e, 'THROWS', e);
                throw e;
            }
        }

        return maybeTraced as T;
    }
}

export interface Logger extends Record<LogLevelName, LogMethod> { }
for (const level of levels) {
    Logger.prototype[LogLevel[level] as LogLevelName] = createLogMethod(level);
}

function createLogMethod(level: LogLevel): LogMethod {
    return function log(this: Logger) {
        if (this.level > level) {
            // Current level disabled
            return false;
        }
        if (arguments.length) {
            const record = createLogRecord.apply(this, arguments as any);
            // If no handlers are registered, let consoleHandler handle log.
            if (logHandlers.length === 0) {
                consoleHandler(record);
            } else {
                for (const handler of logHandlers) {
                    handler(record);
                }
            }
        }
        return true;
    };

    function createLogRecord(this: Logger, ...args: any[]): LogRecord {
        const error = args[0] instanceof Error ? args.shift() as Error : undefined;
        const detailsObj = args[0] && typeof args[0] === 'object' ? args.shift() : undefined;
        const message = args.length ? args.join(' ') : String(error);
        const details = error
            ? { stack: fullStack(error), ...errorInfo(error), ...detailsObj }
            : detailsObj && { ...detailsObj };

        return { logger: this.name, level, time: new Date, details, message };
    }
}

// tslint:disable:unified-signatures
export interface LogMethod {
    /**
     * Returns whether this level is currently enabled.
     */
    (this: Logger): boolean;

    /**
     * Logs the error with additional details plus error information (such as stack) if this level is currently enabled. Returns true iff
     * something was logged.
     */
    (this: Logger, err: Error, details: object, ...messageParts: any[]): boolean;

    /**
     * Logs the error with additional error information (such as stack) if this level is currently enabled. Returns true iff something was
     * logged.
     */
    (this: Logger, err: Error, ...messageParts: any[]): boolean;

    /**
     * Log a message with additional details if this level is currently enabled. Returns true iff something was logged.
     */
    (this: Logger, details: object, msg: any, ...messageParts: any[]): boolean;

    /**
     * Log a message if this level is currently enabled. Returns true iff something was logged.
     */
    (this: Logger, msg: any, ...messageParts: any[]): boolean;
}
// tslint:enable:unified-signatures

function simpleInspect(obj: any) {
    switch (typeof obj) {
        case 'boolean':
        case 'number':
        case 'string':
            return JSON.stringify(obj);
        default:
            return String(obj);
    }
}
