import { expect } from 'chai';
import { spy } from 'sinon';
import * as util from 'util';
import { FormattedLogRecord } from './logrecord';

describe('FormattedLogRecord', () => {
    it('should provide a correct and nice JSON structure with formatted message', () => {
        const record = new FormattedLogRecord('logger', 100, new Date('2017-01-01T01:01:01.000Z'), { a: 1 }, 'message %s', ['with params']);
        expect(JSON.parse(JSON.stringify(record))).to.deep.equal({
            logger: 'logger',
            level: 100,
            time: '2017-01-01T01:01:01.000Z',
            details: { a: 1 },
            message: 'message with params',
        });
    });

    it('should lazily format the message', () => {
        const utilFormat = spy(util, 'format');
        const record = new FormattedLogRecord('logger', 100, new Date, undefined, 'message %s %d %s', ['with', 3, 'params']);
        expect(utilFormat).to.not.have.been.called;
        record.message;
        expect(utilFormat).to.have.been.calledOnce;
        record.message;
        expect(utilFormat).to.have.been.calledOnce;
        utilFormat.restore();
    });
});
