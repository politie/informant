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
