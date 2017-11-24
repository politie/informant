import { inspect } from 'util';
import { Info as InfoObject, Options, VError } from 'verror';

export { InfoObject };
export { errorForEach, errorFromList, findCauseByName, fullStack, hasCauseWithName, info as errorInfo } from 'verror';

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
