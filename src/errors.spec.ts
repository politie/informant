import { expect } from 'chai';
import { spy } from 'sinon';
import { BaseError, errorForEach, errorFromList, errorInfo, findCauseByName, fullStack, hasCauseWithName, MultiError } from './errors';

describe('BaseError', () => {
    it('should support aggregated info', () => {
        const err1 = new BaseError({ a: 1, b: 2 }, 'message');
        const err2 = new BaseError(err1, { b: 3, c: 4 }, 'message');
        expect(errorInfo(err2)).to.deep.equal({ a: 1, b: 3, c: 4 });
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
            new BaseError({ info: 'object' }, new Error, 'message'),
            new BaseError({ info: 'object' }, new Error, 'message', 'with', 'parameters'),
            new BaseError({ info: 'object' }, new Error, 'message', 123, 'parameters', new Date, {}),
            // Support for old ES5 style Error invocation
            (BaseError as any)('message'),
        ].forEach(e => expect(e).to.be.an.instanceOf(BaseError));
    });

    it('should throw when constructed with the wrong arguments', () => {
        expect(() => new BaseError(undefined as any)).to.throw();
        expect(() => new BaseError(new Error, undefined as any)).to.throw();
    });

    it('should show a full cause chain', () => {
        const err1 = new BaseError('inner error');
        const err2 = new BaseError(err1, 'middle error');
        const err3 = new BaseError(err2, 'outer error');
        expect(fullStack(err3)).to.match(new RegExp([
            '^BaseError: outer error: middle error: inner error$',
            '[^]+',
            '^caused by: BaseError: middle error: inner error$',
            '[^]+',
            '^caused by: BaseError: inner error$',
            '[^]+',
        ].join(''), 'm'));
    });

    context('(multierrors)', () => {
        describe('errorFromList', () => {
            it('should return undefined on an empty array', () => {
                expect(errorFromList([])).to.be.undefined;
            });

            it('should return the only error on an array of length 1', () => {
                const err = new Error();
                expect(errorFromList([err])).to.equal(err);
            });

            it('should return a MultiError on multiple errors', () => {
                const errors = [new Error('a'), new Error('b')];
                const multi = errorFromList(errors) as MultiError;
                expect(multi).to.be.an.instanceOf(MultiError);
                expect(multi.errors()).to.have.members(errors);
            });
        });

        describe('errorForEach', () => {
            it('should call the callback once with a single error', () => {
                const s = spy();
                const e = new Error();
                errorForEach(e, s);
                expect(s).to.have.been.calledOnce.and.to.have.been.calledWithExactly(e);
            });

            it('should call the callback with every error from a MultiError', () => {
                const s = spy();
                const errors = [new Error(), new Error()];
                const multi = errorFromList(errors)!;
                errorForEach(multi, s);
                expect(s).to.have.been.calledTwice
                    .and.to.have.been.calledWithExactly(errors[0])
                    .and.to.have.been.calledWithExactly(errors[1]);
            });
        });

        describe('MultiError', () => {
            context('(with multiple errors)', () => {
                let errors: Error[];
                let multi: MultiError;
                beforeEach(() => multi = new MultiError(errors = [new Error('a'), new Error('b')]));

                it('should contain the first errormessage in the message', () => {
                    expect(multi.message).to.equal('first of 2 errors: a');
                });

                it('should expose the errors with the errors method', () => {
                    expect(multi.errors()).to.have.members(errors);
                });

                it('should use the first error as cause', () => {
                    expect(multi.cause()).to.equal(errors[0]);
                });

                it('should combine the info objects from the errors', () => {
                    multi = new MultiError([new BaseError({ a: 1 }, 'a'), new BaseError({ b: 2 }, 'b')]);
                    expect(multi.info()).to.deep.equal({ a: 1, b: 2 });
                });
            });

            context('(with one error)', () => {
                let error: Error;
                let multi: MultiError;
                beforeEach(() => multi = new MultiError([error = new Error('the one')]));

                it('show contain the error message from the provided error', () => {
                    expect(multi.message).to.equal('first of 1 error: the one');
                });

                it('should use error as cause', () => {
                    expect(multi.cause()).to.equal(error);
                });
            });
        });
    });

    context('(subclassed)', () => {
        class BipedError extends BaseError {
            constructor(species: string, legs: number, cause?: Error) {
                super(cause, { species, legs }, `Encountered ${species} with ${legs} legs`);
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
            expect(hasCauseWithName(err, 'BipedError')).to.be.true;
            expect(findCauseByName(err, 'BipedError')).to.exist;
            expect(hasCauseWithName(err, 'QuadrupedError')).to.be.false;
            expect(findCauseByName(err, 'QuadrupedError')).not.to.exist;
            expect(hasCauseWithName(new BaseError(err, 'wrapper'), 'BipedError')).to.be.true;
            expect(findCauseByName(new BaseError(err, 'wrapper'), 'BipedError')).to.exist;
            expect(hasCauseWithName(new BaseError(err, 'wrapper'), 'QuadrupedError')).to.be.false;
            expect(findCauseByName(new BaseError(err, 'wrapper'), 'QuadrupedError')).not.to.exist;
        });

        it('should show the correct stack information for subclasses', () => {
            expect(fullStack(err)).to.not.contain('BaseError');
            expect(fullStack(err)).to.match(/^BipedError: Encountered a human with 3 legs/);

            expect(fullStack(new BipedError('a pair of humans', 5, err))).to.match(new RegExp([
                '^BipedError: Encountered a pair of humans with 5 legs: Encountered a human with 3 legs$',
                '[^]+',
                '^caused by: BipedError: Encountered a human with 3 legs$',
                '[^]+',
            ].join(''), 'm'));
        });

        it('should still support aggregated info', () => {
            const cause = new BaseError({ extraLegs: 1 }, 'grown an extra leg');
            const error = new BipedError('a man', 3, cause);
            expect(errorInfo(error)).to.deep.equal({
                extraLegs: 1,
                species: 'a man',
                legs: 3,
            });
        });
    });
});
