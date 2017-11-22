import { expect } from 'chai';
import * as marky from 'marky';
import { spy, stub } from 'sinon';
import { BaseError } from './errors';
import { Logger } from './logger';
import { captureLogging, logHandlers, registerLogHandler, unregisterLogHandler } from './loghandler';
import { levels, logEverything, LogLevel, LogLevelName, logNothing } from './loglevel';
import { LogRecord } from './logrecord';

describe('Logger', () => {
    let records: LogRecord[];
    let restore: () => void;
    beforeEach(() => ({ records, restore } = captureLogging()));
    afterEach(() => restore());

    afterEach(resetLoggers);

    for (const level of levels) {
        const levelName = LogLevel[level] as LogLevelName;
        describe('#' + levelName, () => {
            let logger: Logger;
            beforeEach('create the loggers', () => {
                Logger.get('above').level = level + 100;
                Logger.get('below').level = level - 100;
                Logger.get('on').level = level;
                logger = Logger.get('on');
            });

            it(`should only log something when the logger is set to level LogLevel.${levelName} or below`, () => {
                expect(records).to.be.empty;
                Logger.get('above')[levelName]('a message');
                expect(records).to.be.empty;
                Logger.get('on')[levelName]('a message');
                expect(records).to.have.length(1);
                Logger.get('below')[levelName]('a message');
                expect(records).to.have.length(2);
            });

            it('should format messages with sprintf-like parameters', () => {
                logger[levelName]('a %s with %d parameters, including an object: %j', 'message', 3, { a: 1 });
                expect(records[0].message).to.equal('a message with 3 parameters, including an object: {"a":1}');
            });

            it('should always log all parameters even with a missing replacement-string', () => {
                logger[levelName]('a message with a %s, but also:', 'parameter', 'other stuff', { like: 'this' });
                expect(records[0].message).to.equal(`a message with a parameter, but also: other stuff { like: 'this' }`);
            });

            it('should pass a complete LogRecord to all handlers', () => {
                const handler1 = stub();
                const handler2 = stub();

                registerLogHandler(handler1);
                registerLogHandler(handler2);
                logger[levelName]('whatever');
                unregisterLogHandler(handler1);
                unregisterLogHandler(handler2);

                const record = records[0];

                expect(handler1).to.have.been.calledOnce.and.to.have.been.calledWithExactly(record);
                expect(handler2).to.have.been.calledOnce.and.to.have.been.calledWithExactly(record);
                const { details, level: recordLevel, logger: recordLogger, message, time } = record;
                expect(details).to.be.undefined;
                expect(recordLevel).to.equal(level);
                expect(recordLogger).to.equal(logger.name);
                expect(message).to.equal('whatever');
                expect(time.getTime()).to.be.at.most(Date.now(), 'time is in future');
                expect(time.getTime()).to.be.at.least(Date.now() - 100, 'time is in past');
            });

            it('should support additional details with a details argument', () => {
                const details = { additional: 'details', with: { arbitrary: 'structure' } };
                logger[levelName](details, 'and message');
                expect(records[0].details).to.deep.equal(details);
                expect(records[0].details).not.to.equal(details);
            });

            it('should automatically extract additional details from a passed in Error object', () => {
                const error = new Error('new message');
                logger[levelName](error);
                const { details, message } = records[0];
                expect(details).to.deep.equal({
                    stack: error.stack,
                });
                expect(message).to.equal(String(error));
            });

            it('should support full-stacks and info objects from BaseError', () => {
                const innerError = new BaseError({ requestId: 123 }, 'this error was wrapped');
                const outerError = new BaseError(innerError, { graph: 'abc' }, 'I wrapped an Error');
                logger[levelName](outerError);
                const { details, message } = records[0];
                expect(message).to.equal(String(outerError));
                expect(details).to.deep.equal({
                    stack: outerError.fullStack(),
                    requestId: 123,
                    graph: 'abc',
                });
            });

            it('should merge information from an Error and provided details objects', () => {
                const error = new BaseError({ errorInfo: 'abc' }, 'the error message');
                logger[levelName](error, { logInfo: 'def' }, 'log message');
                const { details, message } = records[0];
                expect(message).to.equal('log message');
                expect(details).to.deep.equal({
                    stack: error.stack,
                    errorInfo: 'abc',
                    logInfo: 'def',
                });
            });
        });
    }

    describe('#measure', () => {
        let logger: Logger;
        let stop: () => void;
        beforeEach('get the measure method', () => {
            logger = Logger.get('measure');
            logger.level = LogLevel.performance;
            stop = logger.measure('the measurement');
        });
        afterEach('stop if needed', () => stop());

        it('should not log anything in the first call', () => {
            expect(records).to.be.empty;
        });

        it('should return a closure that stops and logs the measurement', () => {
            expect(stop).to.be.a('function');
            stop();
            expect(records).to.have.length(1);
        });

        context('after stopping', () => {
            let record: LogRecord<PerformanceEntry>;
            beforeEach('stop the measurement', () => {
                stop();
                record = records[0] as LogRecord<PerformanceEntry>;
            });

            it('should report a duration and the name of the measurement in the details', () => {
                expect(record.details.duration).to.be.a('number');
                expect(record.details.duration).to.be.below(100, 'curiously large number!');
                expect(record.details.startTime).to.be.a('number');
                expect(record.details.name).to.equal('the measurement');
            });

            it('should have a human friendly message', () => {
                expect(record.message).to.match(/^the measurement -\t[\d.]+ms$/);
            });

            it('should silently handle calling the returned stopper again', () => {
                expect(stop).not.to.throw();
            });
        });

        it('should be able to handle nested measurements with the same name', () => {
            const stop2 = logger.measure('the measurement');
            stop2();
            stop();
            expect(records).to.have.length(2);
            const [entry1, entry2] = records.map(r => r.details as PerformanceEntry);
            expect(entry1.name).to.equal('the measurement');
            expect(entry2.name).to.equal('the measurement');
            expect(entry2.duration).to.not.be.below(entry1.duration);
            expect(entry2.startTime).to.not.be.above(entry1.startTime);
        });

        it('should not perform a measurement if LogLevel.performance is not enabled', () => {
            const s = spy(marky, 'mark');
            logger.level = LogLevel.info;
            logger.measure('whatever')();
            expect(s).not.to.have.been.called;
            expect(records).to.be.empty;
            s.restore();
        });
    });

    describe('#childLogger', () => {
        let base: Logger;
        beforeEach('create the base logger', () => base = Logger.get('base'));

        it('should get or create the correct child logger', () => {
            expect(base.childLoggers).to.deep.equal({});
            const child = base.childLogger('child');
            expect(base.childLoggers).to.have.keys('child');

            expect(Logger.get('base.child')).to.equal(child);
        });

        it('should support having two children of different parents with the same name', () => {
            expect(Logger.get('base.child')).not.to.equal(Logger.get('other.child'));
        });

        it('should accept a string path', () => {
            const grandchild = base.childLogger('child.grandchild');
            expect(base.childLoggers).to.have.keys('child');
            expect(base.childLogger('child').childLoggers).to.have.keys('grandchild');

            expect(Logger.get('base.child.grandchild')).to.equal(grandchild);
        });

        it('should accept an empty string and an empty array', () => {
            expect(base.childLogger([])).to.equal(base);
            expect(base.childLogger('')).to.equal(base);
        });

        it('should throw on an array or a string with empty path components', () => {
            expect(() => base.childLogger('a..b')).to.throw();
            expect(() => base.childLogger(['a', '', 'b'])).to.throw();
        });

        it('should accept an array path', () => {
            const grandchild = base.childLogger(['child', 'grandchild']);
            expect(base.childLoggers).to.have.keys('child');
            expect(base.childLogger('child').childLoggers).to.have.keys('grandchild');

            expect(Logger.get('base.child.grandchild')).to.equal(grandchild);
        });

        it('should initialise new child loggers to the loglevel of the parent', () => {
            base.level = LogLevel.trace;
            expect(base.childLogger('child').level).to.equal(LogLevel.trace);
            base.level = LogLevel.error;
            expect(base.childLogger('child').level).to.equal(LogLevel.trace);
        });
    });

    describe('#setChildLoggersLevel', () => {
        it('should set the level of the logger and all of its children to the provided level', () => {
            const parent = Logger.get('parent');
            const child = Logger.get('parent.child');
            const grandchild = Logger.get('parent.child.grandchild');
            expect(grandchild.level).to.equal(LogLevel.info);
            Logger.get('').setChildLoggersLevel(LogLevel.trace);
            expect(parent.level).to.equal(LogLevel.trace);
            expect(child.level).to.equal(LogLevel.trace);
            expect(grandchild.level).to.equal(LogLevel.trace);

            child.setChildLoggersLevel(LogLevel.error);
            expect(parent.level).to.equal(LogLevel.trace);
            expect(child.level).to.equal(LogLevel.error);
            expect(grandchild.level).to.equal(LogLevel.error);
        });

        it('should return an instance of itself for method chaining', () => {
            const logger = Logger.get('myLogger');
            expect(logger.setChildLoggersLevel(LogLevel.debug), 'passing deep equality').to.deep.equal(logger);
            expect(logger.setChildLoggersLevel(LogLevel.warning), 'passing === equality').to.equal(logger);
            expect(logger.setChildLoggersLevel(LogLevel.error)).to.be.instanceOf(Logger);
        });
    });

    describe('#measureWrap', () => {
        let logger: Logger;
        before(() => {
            logger = Logger.get('measureWrap test');
            logger.level = LogLevel.performance;
        });
        after(resetLoggers);

        let func: (...args: any[]) => string;
        let fails: (reason: string) => never;
        beforeEach('create the wrapped functions', () => {
            func = logger.measureWrap('funcName', (...args: any[]) => args.join(' '));
            fails = logger.measureWrap('failsName', (reason: string) => { throw new BaseError({ code: 'abc' }, reason); });
        });

        it('should follow a fast path when performance level is not enabled', () => {
            const loggerMeasure = spy(logger, 'measure');
            logger.level = logNothing;
            func();
            expect(loggerMeasure).to.not.have.been.called;
            logger.level = logEverything;
            func();
            expect(loggerMeasure).to.have.been.calledOnce;
            loggerMeasure.restore();
        });

        it('should log the time spent inside the method with any parameters involved.', () => {
            func('string', 1337, { obj: { a: 1, b: { c: 3 } } });
            expect(records).to.have.length(1);
            const { details: { name, duration }, message } = records[0] as LogRecord<PerformanceEntry>;
            expect(name).to.equal(`funcName('string', 1337, { obj: [Object] })`);
            expect(duration).to.be.a('number').and.to.be.below(2);
            expect(message).to.match(/funcName\('string', 1337, { obj: \[Object] }\)\s+-\s+\d+ms/);
        });

        it('should log on LogLevel.performance', () => {
            func();
            expect(records[0].level).to.equal(LogLevel.performance);
        });

        it('should log an error if any occurs, but still log the time spent inside the method', () => {
            expect(() => fails('my reason')).to.throw('my reason');
            expect(records).to.have.length(2);
            const { details: { code, stack }, message: errorMessage } = records[0] as LogRecord<{ code: string, stack: string }>;
            expect(code).to.equal('abc');
            expect(stack).to.be.a('string');
            expect(errorMessage).to.contain('my reason');
            const { details: { name }, message } = records[1] as LogRecord<PerformanceEntry>;
            expect(name).to.equal(`failsName('my reason')`);
            expect(message).to.match(/failsName\('my reason'\)\s+-\s+\d+ms/);
        });
    });

    describe('#traceWrap', () => {
        let logger: Logger;
        before(() => {
            logger = Logger.get('trace test');
            logger.level = LogLevel.trace;
        });
        after(resetLoggers);

        let func: (...args: any[]) => string;
        let funcWithOptions: (...args: any[]) => string;
        let fails: (reason: string) => never;
        beforeEach('create the wrapped functions', () => {
            func = logger.traceWrap('funcName', (...args: any[]) => args.join(' '));
            funcWithOptions = logger.traceWrap('funcWithOptionsName',
                (...args: any[]) => func(...args) + ' from func',
                { depth: 0 },
            );
            fails = logger.traceWrap('failsName', (reason: string) => { throw new BaseError({ code: 'abc' }, reason); });
        });

        it('should follow a fast path when trace level is not enabled', () => {
            const loggerTrace = spy(logger, 'trace');
            logger.level = logNothing;
            func();
            expect(loggerTrace).to.have.been.calledOnce
                .and.to.have.been.calledWithExactly();
            expect(records).to.be.empty;
            logger.level = logEverything;
            func();
            expect(records).not.to.be.empty;
            loggerTrace.restore();
        });

        it('should log on LogLevel.trace', () => {
            func();
            expect(records).to.have.length(2);
            expect(records[0].level).to.equal(LogLevel.trace);
            expect(records[1].level).to.equal(LogLevel.trace);
        });

        it('should log all parameters and the result of the call', () => {
            func('string', 1337, { object: { with: { arbitrary: 'nesting' } } });
            expect(records.map(r => r.message)).to.deep.equal([
                `funcName('string', 1337, { object: { with: { arbitrary: 'nesting' } } })`,
                `RETURNS 'string 1337 [object Object]'`,
            ]);
        });

        it('should log an exception if it occurs', () => {
            expect(() => fails('error message')).to.throw('error message');
            expect(records.map(r => r.message)).to.deep.equal([
                `failsName('error message')`,
                `THROWS BaseError: error message`,
            ]);
            const { stack, code } = records[1].details as any;
            expect(code).to.equal('abc');
            expect(stack).to.be.a('string');
        });

        it('should use the inspect options if provided', () => {
            funcWithOptions('string', 1337, { object: { with: { arbitrary: 'nesting' } } });
            expect(records[0].message).to.equal(`funcWithOptionsName('string', 1337, { object: [Object] })`);
        });

        it('should support nested calls', () => {
            funcWithOptions('string', 1337, { object: { with: { arbitrary: 'nesting' } } });
            expect(records.map(r => r.message)).to.deep.equal([
                `funcWithOptionsName('string', 1337, { object: [Object] })`,
                `funcName('string', 1337, { object: { with: { arbitrary: 'nesting' } } })`,
                `RETURNS 'string 1337 [object Object]'`,
                `RETURNS 'string 1337 [object Object] from func'`,
            ]);
        });
    });
});

describe('Logger', () => {
    const consoleInfo = stub(console, 'info');
    afterEach(() => consoleInfo.restore());

    describe('without a registered logHandler', () => {
        it('should default to consoleHandler', () => {
            expect(logHandlers.length).to.equal(0);

            const logger = Logger.get('withoutHandler');
            logger.info('hello without a handler');

            expect(consoleInfo).to.have.been.calledWithMatch(/hello without a handler/);
        });
    });
});

export function resetLoggers() {
    const root = Logger.get('');
    for (const child of Object.keys(root.childLoggers)) {
        delete root.childLoggers[child];
    }
    root.level = LogLevel.info;
}
