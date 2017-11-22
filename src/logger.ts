import { mark, stop } from 'marky';
import { inspect, InspectOptions } from 'util';
import { errorInfo, fullStack } from './errors';
import { consoleHandler, logHandlers } from './loghandler';
import { levels, LogLevel, LogLevelName } from './loglevel';
import { FormattedLogRecord, LogRecord } from './logrecord';

const measureInspectOptions: InspectOptions = { depth: 0 };

let uniqueId = 0;

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
        public readonly name: string,
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
     * Start a performance measurement, stops the measurement and logs when the returned callback is called. Does nothing when the
     * LogLevel.performance is not enabled on the current Logger.
     *
     * @param name the name of the measurement
     */
    measure(name: string) {
        if (!this.performance()) { return () => undefined; }
        const uniqueName = `${name} ${uniqueId++}`;
        let done = false;

        mark(uniqueName);
        return () => {
            if (done) { return; }
            done = true;
            const { duration, startTime } = stop(uniqueName);
            this.performance({ duration, startTime, name }, '%s -\t%dms', name, duration && duration.toFixed(0));
        };
    }

    /**
     * Wrap the given function to measure the amount of time a single method calls takes, does nothing if LogLevel.performance is
     * not enabled on the this logger.
     *
     * @param name the name under which to log the measurements
     * @param func the function to wrap
     */
    measureWrap<T extends (...args: any[]) => any>(name: string, func: T): T {
        const logger = this;

        function maybeMeasured(this: any) {
            return logger.performance() ? measured.apply(this, arguments) : func.apply(this, arguments);
        }

        function measured(this: any, ...args: any[]) {
            const stopper = logger.measure(`${name}(${args.map(a => inspect(a, measureInspectOptions)).join(', ')})`);
            try {
                return func.apply(this, arguments);
            } catch (e) {
                logger.performance(e);
                throw e;
            } finally {
                stopper();
            }
        }

        return maybeMeasured as T;
    }

    /**
     * Wrap the given function to trace all calls to the method and logs both the entry and exit from the method, only if LogLevel.trace
     * is enabled for this logger.
     *
     * @param name the name under which to log the traces
     * @param func the function to wrap
     * @param options optional options that should be passed to util.inspect when inspecting parameters to the method call
     */
    traceWrap<T extends (...args: any[]) => any>(name: string, func: T, options: InspectOptions = {}): T {
        const logger = this;

        function maybeTraced(this: any) {
            return logger.trace() ? traced.apply(this, arguments) : func.apply(this, arguments);
        }

        function traced(this: any, ...args: any[]) {
            logger.trace(`${name}(${args.map(a => inspect(a, options)).join(', ')})`);
            try {
                const result = func.apply(this, arguments);
                logger.trace('RETURNS', inspect(result, options));
                return result;
            } catch (e) {
                logger.trace(e, 'THROWS', String(e));
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
            const record = createLogRecord.apply(this, arguments);
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
        const message = args.length ? args.shift() : String(error);
        const details = error
            ? { stack: fullStack(error), ...errorInfo(error), ...detailsObj }
            : detailsObj && { ...detailsObj };

        return new FormattedLogRecord(this.name, level, new Date, details, message, args);
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
    (this: Logger, err: Error, details: object, msg?: any, ...args: any[]): boolean;

    /**
     * Logs the error with additional error information (such as stack) if this level is currently enabled. Returns true iff something was
     * logged.
     */
    (this: Logger, err: Error, msg?: any, ...args: any[]): boolean;

    /**
     * Log a message with additional details if this level is currently enabled. Returns true iff something was logged.
     */
    (this: Logger, details: object, msg: any, ...args: any[]): boolean;

    /**
     * Log a message if this level is currently enabled. Returns true iff something was logged.
     */
    (this: Logger, msg: any, ...args: any[]): boolean;
}
// tslint:enable:unified-signatures
