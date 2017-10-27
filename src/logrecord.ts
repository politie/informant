import { format } from 'util';
import { LogLevel } from './loglevel';

/**
 * The LogRecord is constructed on every log statement if the corresponding LogLevel is enabled. The same LogRecord
 * instance is passed to all registered LogHandlers.
 */
export interface LogRecord<T = object | undefined> {
    /** The name of the Logger that constructed the LogRecord. */
    readonly logger: string;

    /** The LogLevel on which the message was logged. (a number) */
    readonly level: LogLevel;

    /** The time at the time of logging. */
    readonly time: Date;

    /** Optional object with structured information about the event that was logged. */
    readonly details: T;

    /** The message that was passed to the log method or extracted from an Error object. */
    readonly message: string;
}

export class FormattedLogRecord<T = object | undefined> implements LogRecord<T> {
    constructor(
        public readonly logger: string,
        public readonly level: LogLevel,
        public readonly time: Date,
        public readonly details: T,
        private readonly msg: any,
        private readonly params: any[],
    ) { }

    private _message: string | undefined = undefined;
    get message() {
        if (this._message === undefined) {
            this._message = format(this.msg, ...this.params);
        }
        return this._message;
    }

    toJSON() {
        return {
            logger: this.logger,
            level: this.level,
            time: this.time.toISOString(),
            details: this.details,
            message: this.message,
        };
    }
}
