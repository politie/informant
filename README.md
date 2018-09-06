# Informant

[![Greenkeeper badge](https://badges.greenkeeper.io/politie/informant.svg)](https://greenkeeper.io/)
[![Coverage Status](https://coveralls.io/repos/github/politie/informant/badge.svg?branch=master)](https://coveralls.io/github/politie/informant?branch=master)

Informant is a simple and fast logging library for Node.js and browser JavaScript applications, built with TypeScript. It is hierarchical, supports multiple handlers and includes special support for Errors created with the the `verror` package (see also `BaseError` in this package for easy subclassing in TypeScript).


## Introduction

### Getting a logger

Like most logging libraries you get a Logger instance and call methods named after the logging levels:

```typescript
// myComponent.ts
import { Logger } from '@politie/informant';

const logger = Logger.get('myLibrary.myComponent');
logger.info('hi');
logger.warning(`Don't know what to do.`);
```

You can get a `Logger` with `Logger.get(name: string)`. This will lookup the logger or create it if needed. Loggers are hierarchical. In the example above we got the logger for `myComponent`, which is a child of the `myLibrary` logger, which in turn is a child of the root logger. The root logger can be accessed with: `Logger.get('')`.


### Enabling logging with a LogHandler and the right LogLevel

The logger hierarchy can be used to set LogLevels for whole subtrees of Loggers or to filter log-messages. By default log messages end up nowhere. It is up to the consumer of your libaries (the application) to setup one or more LogHandlers. This library provides a basic `consoleHandler` that will log all messages to the console.

```typescript
// application/index.ts
import { registerLogHandler, consoleHandler, Logger, LogLevel } from '@politie/informant';

// Enable logging to the console.
registerLogHandler(consoleHandler);

// Enable the trace LogLevel for a certain library.
Logger.get('certainLibrary').setChildLoggersLevel(LogLevel.trace);
```

### Storing structured data to the logs

Log messages can contain structured data that can help with analysis of the logs. This data can be provided as an object or automatically extracted from Errors (see the section about VError below).

```typescript
// A combined example of structured data from VErrors and provided in the log statement.

/**
 * An Error that can be used for HTTP Errors.
 */
class HttpError extends VError {
    constructor(requestId: number, message: string) {
        super({ info: { requestId } }, message);
    }
}

function tryRequest(request: Request) {
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
            // HttpError occurs somewhere... throw new HttpError(requestId, 'Error occurred');
        } catch (error) {
            // log error...
            logger.info(error, { retry }, 'Attempt to perform request failed');
        }
    }
    logger.warning('Maximum attempts reached, stopping.');
}
```

The `logger.info` will log the message `'Attempt to perform request failed'`, but also an object with additional details. In this case it contains the key `retry` which is a number, the `requestId` from the Error and the `stack` from the Error.


# The LogLevels

The following log methods (and LogLevels) are supported:

- `trace`

    Very detailed application logging and also the maximum loglevel in low-level libraries (such as derivable), rarely enabled during runtime.

- `debug`

    Messages that might give insight in state or events during debugging (in production). Too detailed to include in error-reports. Disabled by default.

- `performance`

    Performance measurements to be able to diagnose performance issues in production or in development.

- `info`

    Details on regular operations, e.g. Activity was started or the user clicked a certain button. Info messages can be included in error reports (e.g. last *x* info-messages are recorded and sent on error or warning). Note that because info messages will most likely be recorded, info is the default LogLevel for new Loggers.

- `warning`

    A message that represents an issue that needs to be addressed by a developer sometime. Warnings are given for a reason, if a warning message occurs often, fix the issue or decide it is actually regular operation and therefore should be LogLevel.info.

- `error`

    Represents an issue that needs to be addressed soon. An error is an issue that will cause the application to fail or crash or might cause a user to lose data.

In general: Use "debug" sparingly. Information that will be useful to debug errors post mortem should usually be included in "info" messages if it's generally relevant or else with the corresponding "error" event. Don't rely on spewing mostly irrelevant debug messages all the time and sifting through them when an error occurs.

Libraries should only ever log at trace-level. Fine control over log output should be up to the app using a library. Having a library that spews log output at higher levels gets in the way of a clear story in the app logs.


# The LogMethod API

All possible uses of the logging methods:

```typescript

// Returns whether this level is currently enabled.
logger.info();

// Log a message if this level is currently enabled. Returns true iff something was logged.
logger.info('hi');
logger.info('hi %s', name);

// Log a message with additional details if this level is currently enabled. Returns true iff something was logged.
logger.info({ username: name }, 'Failed login attempt for %s', name);

// Logs the error with additional error information (such as stack) if this level is currently enabled. Returns true iff something was
// logged.
logger.info(err);
logger.info(err, 'another message');

// Logs the error with additional details plus error information (such as stack) if this level is currently enabled. Returns true iff
// something was logged.
logger.info(err, { additional: 'information' });
logger.info(err, { additional: 'information' }, 'and another message');
```

The same goes for all LogLevels, see the section above on LogLevels.


# LogRecord

When logging to an enabled LogLevel, a LogRecord is constructed. This LogRecord is passed to all registered LogHandlers.

The LogRecord fields:

- `logger: string`

    The name of the Logger that constructed the LogRecord.

- `level: LogLevel`

    The LogLevel on which the message was logged (a number).

- `time: Date`

    The time at the time of logging.

- `message: string`

    The message that was passed to the log method or extracted from an Error object.

- `details?: object`

    Optional object with structured information about the event that was logged.


# LogHandlers

A LogHandler is a function that accepts LogRecords (the type is simply: `(record: LogRecord) => void`). Note that LogHandlers should serialize the data synchronously because objects that were passed in by reference can be changed later on by the calling code. This can result in confusing or incorrect logged messages.

There are a number of convenience methods that can construct LogHandlers from other LogHandlers which changes the way the inner LogHandlers works.

- `fromLevel`

    Use this to only handle records for the provided level or above. For example to only show messages with level warning and above in the console, use:

    ```typescript
    import { consoleHandler, fromLevel, LogLevel, registerLogHandler } from '@politie/informant';

    registerLogHandler(fromLevel(LogLevel.warning, consoleHandler));
    ```

- `forLogger`

    Use this to only handle records for the provided logger or any of its children. For example to only show messages for the library named `core`, use:

    ```typescript
    import { consoleHandler, forLogger, registerLogHandler } from '@politie/informant';

    registerLogHandler(forLogger('core', consoleHandler));
    ```

- `async`

    This wrapper calls the provided LogHandler as soon as possible, but at least after the current stack finishes (i.e. asynchronously).

    ```typescript
    import { consoleHandler, async, registerLogHandler } from '@politie/informant';

    registerLogHandler(async(consoleHandler));
    ```

- `ringBuffer`

    An efficient RingBuffer implementation that can be used to record the last X records and fetch them when an error occurs or during a debug-session.

    ```typescript
    import { ringBuffer, registerLogHandler } from '@politie/informant';

    const buffer = ringBuffer(50);  // Record the last 50 records
    registerLogHandler(buffer);

    // Or: use registerLogHandler(fromLevel(LogLevel.info, buffer)) to only record info and above.

    // Some code here that logs something...

    buffer.get();                   // Returns the last 50 records
    ```


# Decorators

Informant provides two method-decorators that can be used to quickly add performance measurements and tracing to existing methods.

- `@measure`

    When you add `@measure(logger)` to a method, it will log the execution times of the method whenever `logger` has `LogLevel.performance` enabled.

- `@trace`

    When you add `@trace(logger)` to a method, it will log all entries and exits from this method whenever `logger` has `LogLevel.trace` enabled. It will log all parameters, thrown errors and return values. With an optional second parameter it is possible to change the way parameters and return-values are inspected.

    Example:

    ```typescript
    class MyClass {
        @trace(logger)
        method(str: string, obj: object) {
            return str;
        }

        @trace(logger, { depth: 0 })
        methodWithOptions(str: string, obj: object) {
            throw new Error(str);
        }
    }

    new MyClass().method('abc', { object: { with: { arbitrary: 'nesting' } } });
    // Produces 2 log messages:
    // - MyClass#method('abc', { object: { with: { arbitrary: 'nesting' } } })
    // - RETURNS 'abc'

    new MyClass().methodWithOptions('abc', { object: { with: { arbitrary: 'nesting' } } });
    // Produces 2 log messages:
    // - MyClass#methodWithOptions('abc', { object: [Object] })
    // - THROWS Error: abc
    ```

Internally these decorators use `util.inspect` to inspect the parameters and return values. It is possible to provide a custom '*inspection*' method that returns a nice representation of the object. See the documentation of this package for more information.

- `@deprecated`

    When you add `@deprecated(logger)` to a method, it will log a deprecation warning to `logger` the first time the method is called.


# Using (V)Errors

This library supports Errors created with the `verror` package. It is highly recommended to use these VErrors where possible as these have a number of advantages over normal JavaScript Errors:

- printf-style arguments for the message
- chains of causes
- properties to provide extra information about the error
- creating your own subclasses that support all of these

With VError it is easy to create your own Error classes (that work as expected) as follows:

```typescript
/** A custom error without any specific behavior. */
class MyError extends VError { }

// MyError can be used as any VError, but the stack will contain the name MyError and the MyError class can be used in `instanceof` checks

/** A custom error with specific structured information to automatically log when passed to a informant Logger. */
class MyHttpError extends VError {
    constructor(requestId: number, message: string) {
        super({ info: { requestId } }, message);
    }
}
```

VError automatically cleans the stack (which is otherwise pretty awkward with custom JavaScript errors), so the stack will look as if the custom errors
are ordinary built-in errors.

For more information, see: https://github.com/joyent/node-verror
