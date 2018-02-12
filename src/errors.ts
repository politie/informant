function createExtendableError(): { new(msg: string): Error } {
    function ExtendableError(this: Error, message: string) {
        if (this instanceof Error) {
            Error.call(this, message);
            this.message = message;
        }
    }
    ExtendableError.prototype = Object.create(Error.prototype);
    ExtendableError.prototype.constructor = ExtendableError;
    return ExtendableError as any;
}

/**
 * BaseErrors can be used to create nice subclasses of Error.
 */
export class BaseError extends createExtendableError() {
    /**
     * Create a new BaseError with a cause and a structured info Object.
     */
    constructor(cause: Error | undefined, info: InfoObject | undefined, message: string, ...additional: any[]);

    /**
     * Create a new BaseError with a cause and a structured info Object.
     */
    constructor(info: InfoObject | undefined, cause: Error | undefined, message: string, ...additional: any[]);

    /**
     * Create a new BaseError with a cause or a structured info Object.
     */
    constructor(cause: Error | undefined, message: string, ...additional: any[]);

    /**
     * Create a new BaseError with a cause or a structured info Object.
     */
    // tslint:disable-next-line:unified-signatures
    constructor(info: InfoObject | undefined, message: string, ...additional: any[]);

    /**
     * Create a new BaseError without a cause or a structured info Object.
     */
    constructor(message: string, ...additional: any[]);

    constructor(...args: any[]) {
        super(extractMessage(args));

        // In ES5, constructors are allowed to be called without new. This is supported by Error, so we support it as well.
        if (!(this instanceof BaseError)) {
            return new (BaseError as any)(...args);
        }

        for (const arg of args) {
            if (typeof arg === 'string') { break; }
            if (arg instanceof Error) {
                this._cause = arg;
            } else if (typeof arg === 'object') {
                this._info = { ...arg };
            }
        }

        // istanbul ignore else
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    private readonly _cause?: Error;
    private readonly _info?: InfoObject;

    // Make sure the name of the Error equals the name of the Error constructor.
    get name() { return this.constructor.name; }

    toString() {
        return this.name + ': ' + this.message;
    }

    cause() { return this._cause; }

    info(): InfoObject {
        const c = this.cause();
        if (c instanceof BaseError) {
            return { ...c.info(), ...this._info };
        }
        return { ...this._info };
    }
}

export interface InfoObject {
    [key: string]: any;
}

function extractMessage(args: any[]): string {
    const messageIndex = args.findIndex(arg => typeof arg === 'string');
    if (messageIndex < 0 || messageIndex > 2) {
        throw new Error('Invalid use of BaseError signature, got: ' + args);
    }
    const causeMsg = args[0] instanceof Error ? ': ' + args[0].message : '';
    return args.slice(Math.min(messageIndex, 2)).join(' ') + causeMsg;
}

export function cause(err: Error) {
    if (err instanceof BaseError) {
        return err.cause();
    }
    return;
}

export function errorInfo(err: Error) {
    if (err instanceof BaseError) {
        return err.info();
    }
    return {};
}

export function findCauseByName(err: Error, name: string) {
    for (let c: Error | undefined = err; c != null; c = cause(c)) {
        if (c.name === name) {
            return c;
        }
    }
    return;
}

export function hasCauseWithName(err: Error, name: string) {
    return !!findCauseByName(err, name);
}

export function fullStack(err: Error): string {
    const c = cause(err);
    if (c) {
        return err.stack + '\ncaused by: ' + fullStack(c);
    }
    return String(err.stack);
}

export function errorFromList(errors: Error[]) {
    switch (errors.length) {
        case 0: return;
        case 1: return errors[0];
        default: return new MultiError(errors);
    }
}

export function errorForEach(err: Error, cb: (err: Error) => void) {
    if (err instanceof MultiError) {
        err.errors().forEach(e => cb(e));
    } else {
        cb(err);
    }
}

/*
 * Represents a collection of errors for the purpose of consumers that generally
 * only deal with one error.  Callers can extract the individual errors
 * contained in this object, but may also just treat it as a normal single
 * error, in which case a summary message will be printed.
 */
export class MultiError extends BaseError {
    constructor(private readonly _errors: Error[]) {
        super(_errors[0], Object.assign({}, ..._errors.map(errorInfo)),
            `first of ${_errors.length} error${_errors.length === 1 ? '' : 's'}`);
    }

    errors() {
        return this._errors.slice();
    }
}
