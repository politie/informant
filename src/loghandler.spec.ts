import { expect } from 'chai';
import { createSandbox, spy, stub } from 'sinon';
import {
    async, captureLogging, consoleHandler, forLogger, fromLevel, LogHandler, logHandlers, registerLogHandler, ringBuffer,
    unregisterLogHandler,
} from './loghandler';
import { levels, LogLevel } from './loglevel';
import { LogRecord } from './logrecord';

describe('(un)registerLogHandler', () => {
    it('should add/remove the handler to/from the list of handlers', () => {
        const handler = stub();
        registerLogHandler(handler);
        expect(logHandlers).to.deep.equal([handler]);
        unregisterLogHandler(handler);
        expect(logHandlers).to.deep.equal([]);
    });

    it('should not mind being called twice with the same handler', () => {
        const handler = stub();
        registerLogHandler(handler);
        registerLogHandler(handler);
        expect(logHandlers).to.deep.equal([handler]);
        unregisterLogHandler(handler);
        unregisterLogHandler(handler);
        expect(logHandlers).to.deep.equal([]);
    });
});

describe('captureLogging', () => {
    it('should remove all existing loghandlers and restore them on restore', () => {
        const handler1 = stub();
        const handler2 = stub();
        registerLogHandler(handler1);
        registerLogHandler(handler2);
        const { restore } = captureLogging();
        expect(logHandlers).to.have.length(1);
        expect(logHandlers).not.to.contain(handler1);
        expect(logHandlers).not.to.contain(handler2);
        restore();
        expect(logHandlers).to.have.members([handler1, handler2]);
    });

    it('should record all messages into the returned records array', () => {
        const { records, restore } = captureLogging();
        const expectedRecords = [logRecord(), logRecord()];
        expectedRecords.forEach(logHandlers[0]);
        expect(records).to.have.members(expectedRecords);
        restore();
    });
});

describe('fromLevel', () => {
    it('should filter out records with a level lower than the provided level', () => {
        const h = stub();
        const handler = fromLevel(LogLevel.warning, h);
        handler(logRecord({ level: LogLevel.info }));
        expect(h).to.not.have.been.called;
    });

    it('should pass records with a high enough level to the provided handler', () => {
        const h = stub();
        const handler = fromLevel(LogLevel.warning, h);
        const warning = logRecord({ level: LogLevel.warning });
        const error = logRecord({ level: LogLevel.error });
        handler(warning);
        handler(error);
        expect(h).to.have.been.calledTwice
            .and.to.have.been.calledWithExactly(warning)
            .and.to.have.been.calledWithExactly(error);
    });
});

describe('forLogger', () => {
    it('should pass records from the given logger or any of its children, by string', () => {
        const h = stub();
        const handler = forLogger('base.child', h);
        const baseRecord = logRecord({ logger: 'base' });
        const childRecord = logRecord({ logger: 'base.child' });
        const grandchildRecord = logRecord({ logger: 'base.child.grandchild' });
        const childSuffixRecord = logRecord({ logger: 'base.childSuffix' });

        [baseRecord, childRecord, grandchildRecord, childSuffixRecord].forEach(handler);

        expect(h).to.have.been.calledTwice
            .and.to.have.been.calledWithExactly(childRecord)
            .and.to.have.been.calledWithExactly(grandchildRecord);
    });

    it('should pass records from the given logger or any of its children', () => {
        const h = stub();
        const handler = forLogger(/.*-test/, h);
        const simpleRecord = logRecord({ logger: 'test' });
        const aRecord = logRecord({ logger: 'a-test' });
        const bChildRecord = logRecord({ logger: 'base-test.child' });
        const suffixRecord = logRecord({ logger: 'another-testlogger' });
        const infixRecord = logRecord({ logger: 'in-fixtest' });

        [simpleRecord, aRecord, bChildRecord, suffixRecord, infixRecord].forEach(handler);

        expect(h).to.have.been.calledThrice
            .and.to.have.been.calledWithExactly(aRecord)
            .and.to.have.been.calledWithExactly(bChildRecord)
            .and.to.have.been.calledWithExactly(suffixRecord);
    });
});

describe('async', () => {
    it('should call the provided handler asynchronously', async () => {
        let syncHandler: LogHandler | undefined;
        const p = new Promise<LogRecord>(resolve => syncHandler = spy(resolve));
        const asyncHandler = async(syncHandler!);
        const record = logRecord();
        asyncHandler(record);

        expect(syncHandler).to.not.have.been.called;

        await p;

        expect(syncHandler).to.have.been.calledOnce
            .and.to.have.been.calledWithExactly(record);
    });
});

describe('consoleHandler', () => {
    for (const level of levels) {
        it(`should call the right console method for level LogLevel.${LogLevel[level]}`, () => {
            const record = logRecord({ level });
            const sb = createSandbox();
            const consoleError = sb.stub(console, 'error');
            const consoleWarn = sb.stub(console, 'warn');
            const consoleInfo = sb.stub(console, 'info');
            const consoleLog = sb.stub(console, 'log');
            consoleHandler(record);
            // Restore early to be able to see messages from mocha.
            sb.restore();
            expect(consoleError).to.have.callCount(level === LogLevel.error ? 1 : 0);
            expect(consoleWarn).to.have.callCount(level === LogLevel.warning ? 1 : 0);
            expect(consoleInfo).to.have.callCount(level === LogLevel.info ? 1 : 0);
            expect(consoleLog).to.have.callCount(level < LogLevel.info ? 1 : 0);
        });
    }

    it('should provide additional information in case of a details object', () => {
        const details = { a: 1 };
        const consoleInfo = stub(console, 'info');
        consoleHandler(logRecord({ details }));
        consoleInfo.restore();
        expect(consoleInfo).to.have.been.calledWithMatch(/.*\tINFO\tlogger: message, details:/, details);
    });
});

describe('ringBuffer', () => {
    it('should work like a RingBuffer', () => {
        const maxSize = 4;
        const rb = ringBuffer<number>(maxSize);

        expect(rb.size).to.equal(0);

        const results = [];
        for (let i = 1; i < 20; i++) {
            rb(i);
            results.push(i);
            expect(rb.size).to.equal(Math.min(i, maxSize));
            expect(rb.get()).to.deep.equal(results.slice(-maxSize));
        }
    });

    it('should have a default size of 100', () => {
        const rb = ringBuffer<number>();
        for (let i = 0; i < 101; i++) {
            rb(i);
        }
        expect(rb.size).to.equal(100);
        expect(rb.get()).to.have.length(100);
    });
});

function logRecord(partial: Partial<LogRecord> = {}): LogRecord {
    return {
        details: undefined,
        level: LogLevel.info,
        logger: 'logger',
        message: 'message',
        time: new Date,
        ...partial,
    };
}
