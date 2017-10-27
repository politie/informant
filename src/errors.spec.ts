import { expect } from 'chai';
import { BaseError } from './errors';

describe('BaseError', () => {
    it('should support aggregated info', () => {
        const err1 = new BaseError({ a: 1, b: 2 }, 'message');
        const err2 = new BaseError(err1, { b: 3, c: 4 }, 'message');
        expect(err2.info()).to.deep.equal({ a: 1, b: 3, c: 4 });
    });

    it('should support all signatures that are allowed by TypeScript', () => {
        [
            new BaseError('message'),
            new BaseError('message', 'with', 'parameters'),
            new BaseError('message', 123, 'parameters', new Date, {}),
            new BaseError(undefined, 'message'),
            new BaseError(undefined, 'message', 'with', 'parameters'),
            new BaseError(undefined, 'message', 123, 'parameters', new Date, {}),
            new BaseError(new Error, 'message'),
            new BaseError(new Error, 'message', 'with', 'parameters'),
            new BaseError(new Error, 'message', 123, 'parameters', new Date, {}),
            new BaseError({ info: 'object' }, 'message'),
            new BaseError({ info: 'object' }, 'message', 'with', 'parameters'),
            new BaseError({ info: 'object' }, 'message', 123, 'parameters', new Date, {}),
            new BaseError(undefined, undefined, 'message'),
            new BaseError(undefined, undefined, 'message', 'with', 'parameters'),
            new BaseError(undefined, undefined, 'message', 123, 'parameters', new Date, {}),
            new BaseError(new Error, undefined, 'message'),
            new BaseError(new Error, undefined, 'message', 'with', 'parameters'),
            new BaseError(new Error, undefined, 'message', 123, 'parameters', new Date, {}),
            new BaseError(undefined, { info: 'object' }, 'message'),
            new BaseError(undefined, { info: 'object' }, 'message', 'with', 'parameters'),
            new BaseError(undefined, { info: 'object' }, 'message', 123, 'parameters', new Date, {}),
            new BaseError(new Error, { info: 'object' }, 'message'),
            new BaseError(new Error, { info: 'object' }, 'message', 'with', 'parameters'),
            new BaseError(new Error, { info: 'object' }, 'message', 123, 'parameters', new Date, {}),
        ].forEach(e => expect(e).to.be.an.instanceOf(BaseError));
    });

    it('should throw when constructed with the wrong arguments', () => {
        expect(() => new BaseError(undefined as any)).to.throw();
        expect(() => new BaseError(new Error, undefined as any)).to.throw();
        expect(() => new BaseError({ a: 1 } as any, new Error, 'message')).to.throw();
    });

    it('should show a full cause chain', () => {
        const err1 = new BaseError('inner error');
        const err2 = new BaseError(err1, 'middle error');
        const err3 = new BaseError(err2, 'outer error');
        expect(err3.fullStack()).to.match(new RegExp([
            '^BaseError: outer error: middle error: inner error$',
            '[^]+',
            '^caused by: BaseError: middle error: inner error$',
            '[^]+',
            '^caused by: BaseError: inner error$',
            '[^]+',
        ].join(''), 'm'));
    });

    context('(subclassed)', () => {
        class BipedError extends BaseError {
            constructor(species: string, legs: number, cause?: Error) {
                super(cause, { species, legs }, `Encountered %s with %d legs`, species, legs);
            }
        }
        const err = new BipedError('a human', 3);

        it('should work as an ordinary Error', () => {
            expect(err.message).to.equal('Encountered a human with 3 legs');
            expect(String(err)).to.equal('BipedError: Encountered a human with 3 legs');
        });

        it('should support instanceof checks', () => {
            expect(err).to.be.instanceOf(BipedError);
            expect(err).to.be.instanceOf(Error);
        });

        it('should provide the correct name and support findCauseByName', () => {
            expect(err.name).to.equal('BipedError');
            expect(err.constructor.name).to.equal('BipedError');
            expect(err.hasCauseWithName('BipedError')).to.be.true;
            expect(err.findCauseByName('BipedError')).to.exist;
            expect(err.hasCauseWithName('QuadrupedError')).to.be.false;
            expect(err.findCauseByName('QuadrupedError')).not.to.exist;
            expect(new BaseError(err, 'wrapper').hasCauseWithName('BipedError')).to.be.true;
            expect(new BaseError(err, 'wrapper').findCauseByName('BipedError')).to.exist;
            expect(new BaseError(err, 'wrapper').hasCauseWithName('QuadrupedError')).to.be.false;
            expect(new BaseError(err, 'wrapper').findCauseByName('QuadrupedError')).not.to.exist;
        });

        it('should show the correct stack information for subclasses', () => {
            expect(err.fullStack()).to.not.contain('BaseError');
            expect(err.fullStack()).to.match(/^BipedError: Encountered a human with 3 legs/);

            expect(new BipedError('a pair of humans', 5, err).fullStack()).to.match(new RegExp([
                '^BipedError: Encountered a pair of humans with 5 legs: Encountered a human with 3 legs$',
                '[^]+',
                '^caused by: BipedError: Encountered a human with 3 legs$',
                '[^]+',
            ].join(''), 'm'));
        });

        it('should still support aggregated info', () => {
            const cause = new BaseError({ extraLegs: 1 }, 'grown an extra leg');
            const error = new BipedError('a man', 3, cause);
            expect(error.info()).to.deep.equal({
                extraLegs: 1,
                species: 'a man',
                legs: 3,
            });
        });
    });
});
