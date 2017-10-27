/** The LogLevels that are supported by @politie/informant. */
export enum LogLevel {
    /**
     * Maximum loglevel in low-level libraries, rarely enabled during runtime.
     */
    trace = 100,

    /**
     * Messages that give insight in state or events during debuggin (in production). Disabled by default.
     */
    debug = 200,

    /**
     * Performance measurements in production to be able to diagnose performance issues in production.
     */
    performance = 300,

    /**
     * Info messages could be included in error reports (e.g. last x info-messages are recorded and sent on error or warning). Note
     * that info messages will most likely be recorded and therefore is the default LogLevel for new Loggers.
     */
    info = 400,

    /**
     * A message that represents an issue that needs to be addressed by a developer sometime. Warnings are given for a reason,
     * if a warning message occurs often, decide to remove the warning or fix the issue!
     */
    warning = 500,

    /**
     * Represents an issue that needs to be addressed asap. An error is an issue that will cause the application to fail or crash.
     */
    error = 600,
}

/** A LogLevel name. */
export type LogLevelName = 'trace' | 'debug' | 'performance' | 'info' | 'warning' | 'error';

/** All LogLevels in order of ascending gravity. */
export const levels = [LogLevel.trace, LogLevel.debug, LogLevel.performance, LogLevel.info, LogLevel.warning, LogLevel.error];

/**
 * Set your Logger to this to log absolutely everything.
 */
export const logEverything = -Infinity;

/**
 * Use this as LogLevel to turn off a logger.
 */
export const logNothing = Infinity;
