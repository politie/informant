import { expect } from 'chai';
import { SinonFakeTimers, useFakeTimers } from 'sinon';
import { deprecated, measure, trace } from './decorators';
import { Logger } from './logger';
import { resetLoggers } from './logger.spec';
import { captureLogging } from './loghandler';
import { LogLevel } from './loglevel';
import { LogRecord } from './logrecord';

context('decorators', () => {
    let logger: Logger;
    before(() => logger = Logger.get('decorator tests'));
    after(resetLoggers);

    describe('@measure', () => {
        testMethodDecorator('measure', () => measure(logger));

        it('should wrap the method with logger.measureWrap', () => {
            class TestClass {
                @measure(logger)
                method() { return 'whatever'; }
            }

            expect(TestClass.prototype.method.name).to.equal('maybeMeasured');
        });
    });

    describe('@trace', () => {
        testMethodDecorator('trace', () => trace(logger));

        it('should wrap the method with logger.traceWrap', () => {
            class TestClass {
                @trace(logger)
                method() { return 'whatever'; }
            }

            expect(TestClass.prototype.method.name).to.equal('maybeTraced');
        });
    });

    describe('@deprecated', () => {
        testMethodDecorator('deprecated', () => deprecated(logger));

        let records: LogRecord[];
        let restore: () => void;
        beforeEach('record all log messages', () => ({ records, restore } = captureLogging()));
        afterEach('stop recording all log messages', () => restore());

        let clazz: { method(a: string): string; };
        let instance: { method(a: string): string; };
        beforeEach('create the decorator and class-instance', () => {
            class TestClass {
                @deprecated(logger, 'Use another method.')
                method(a: string) { return a; }

                @deprecated(logger, 'Use another method.')
                static method(a: string) { return a; }
            }
            clazz = TestClass;
            instance = new TestClass;
        });
        context('on static method', () => testDeprecatedDecorator('TestClass.method', () => clazz));

        context('on instance method', () => testDeprecatedDecorator('TestClass#method', () => instance));

        function testDeprecatedDecorator(expectedMethodName: string, getInstance: () => { method(a: string): string; }) {
            let inst: { method(a: string): string; };

            beforeEach('create the decorator and class-instance', () => {
                inst = getInstance();
            });

            it('should not change the semantics of the decorated method', () => {
                expect(inst.method('abc')).to.equal('abc');
            });

            context('after calling the method once', () => {
                let clock: SinonFakeTimers;
                beforeEach(() => clock = useFakeTimers());
                afterEach(() => clock.restore());

                beforeEach(() => inst.method('whatever'));

                it('should have created a log message', () => {
                    expect(records).to.have.length(1);
                    expect(records[0].level).to.equal(LogLevel.warning);
                    expect(records[0].message).to.equal(`${expectedMethodName} is deprecated. Use another method.`);
                });

                it('should not warn again within the next second', () => {
                    inst.method('abc');
                    clock.tick(999);
                    inst.method('abc');
                    expect(records).to.have.length(1);
                });

                context('after waiting a second', () => {
                    beforeEach(() => clock.tick(1000));

                    it('should warn again on the next call', () => {
                        expect(records).to.have.length(1);
                        inst.method('abc');
                        expect(records).to.have.length(2);
                        expect(records[1].level).to.equal(LogLevel.warning);
                        expect(records[1].message).to.equal(`${expectedMethodName} is deprecated. Use another method.`);
                    });

                    it('should not warn again within the next second', () => {
                        inst.method('abc');
                        inst.method('abc');
                        inst.method('abc');
                        expect(records).to.have.length(2);

                        clock.tick(1000);

                        inst.method('abc');
                        inst.method('abc');
                        expect(records).to.have.length(3);
                    });
                });
            });
        }
    });

    function testMethodDecorator(name: string, decoratorFactory: () => MethodDecorator) {
        it('should throw an error when used on a getter or a property', () => {
            const decorator = decoratorFactory();
            expect(() => {
                class OnProperty {
                    @(decorator as PropertyDecorator)
                    property?: string;
                }
                return OnProperty;
            }).to.throw(`@${name}() can only be used on method.`);

            expect(() => {
                class OnGetter {
                    @decorator
                    get property() { return 'string'; }
                }
                return OnGetter;
            }).to.throw(`@${name}() can only be used on method.`);

            expect(() => {
                class OnMethod {
                    @decorator
                    method() { return 'string'; }
                }
                return OnMethod;
            }).not.to.throw();
        });

    }
});
