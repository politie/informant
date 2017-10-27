import { inspect } from 'util';
import { findCauseByName, fullStack, hasCauseWithName, info as errorInfo, Info as InfoObject, Options, VError } from 'verror';

/**
 * BaseErrors can be used to create nice subclasses of Error.
 */
export class BaseError extends VError {
    /**
     * Create a new BaseError with a cause and a structured info Object.
     */
    constructor(cause: Error | undefined, info: InfoObject | undefined, message: string, ...args: any[]);

    /**
     * Create a new BaseError with a cause or a structured info Object.
     */
    constructor(cause: Error | undefined, message: string, ...args: any[]);

    /**
     * Create a new BaseError with a cause or a structured info Object.
     */
    // tslint:disable-next-line:unified-signatures
    constructor(info: InfoObject | undefined, message: string, ...args: any[]);

    /**
     * Create a new BaseError without a cause or a structured info Object.
     */
    constructor(message: string, ...args: any[]);

    constructor(...args: any[]) {
        super(extractOptions(args), args[0], ...args.slice(1));
    }

    // Make sure the name of the Error equals the name of the Error constructor.
    get name() { return this.constructor.name; }

    /**
     * Get the structured information associated with this error, merged with information from its cause.
     */
    info(): InfoObject {
        return errorInfo(this);
    }

    /**
     * Get the full stack trace inclusing the cause chain.
     */
    fullStack(): string {
        return fullStack(this);
    }

    /**
     * Returns true iff this error of any of the errors in the cause chain has the specified name.
     */
    hasCauseWithName(name: string) {
        return hasCauseWithName(this, name);
    }

    /**
     * Find an error in the cause chain (including this error) that has the specified name.
     */
    findCauseByName(name: string) {
        return findCauseByName(this, name);
    }
}

function extractOptions(args: any[]): Options {
    const optionCount = args.findIndex(arg => typeof arg === 'string');
    switch (optionCount) {
        case 0: return {};
        case 1: return args[0] instanceof Error ? { cause: args.shift() } : { info: args.shift() };
        case 2: return { cause: args.shift(), info: args.shift() };
        default: throw new Error('Invalid use of BaseError signature, got: ' + inspect(args, { depth: 0 }));
    }
}

export { findCauseByName, fullStack, hasCauseWithName, InfoObject, errorInfo };

export { errorForEach, errorFromList } from 'verror';
