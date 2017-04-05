import { EventEmitter } from "events";

export namespace internal {
    export interface IActionInfo {
        actionName: string;
        description: string;
        middleware?: IActionMiddleware[];
        version?: number;
    }

    export interface IInputParam {
        name: string;
        required: boolean;
        validator?: ValidatorFunction;
        formatter?: FormatterFunction;
        default?: DefaultValueProvider;
    }

    export interface IActionOptions {
        logLevel?: string;
        matchExtensionMimeType?: boolean;
        toDocument?: boolean;
    }

    export interface IActionMiddlewareInfo {
        middlewareName: string;
        global?: boolean;
        priority?: number;
    }

    export interface IRouteInfo {
        path: string;
        method: string;
    }

    export interface IConstructable<T> {
        new (): T;
    }
}

const SuperObjectEB = new EventEmitter();

enum ClassType {
    ACTION, MIDDLEWARE, UNKNOWN,
}

const SuperObjectEventType = {
    ACTION_LOADED: "ACTION_LOADED",
    MIDDLEWARE_LOADED: "MIDDLEWARE_LOADED",
};

// tslint:disable-next-line:ban-types
function getObjectType(constructor: Function): ClassType {
    if (constructor.prototype && constructor.prototype.classType) {
        return constructor.prototype.classType;
    } else {
        return ClassType.UNKNOWN;
    }
}

export type ChainedFunction = (error?: object) => void;
export type ValidatorFunction = (param: object, connection: object, actionTemplate: object) => any;
export type FormatterFunction = (param: object, connection: object, actionTemplate: object) => any;
export type DefaultValueProvider = (param: object, connection: object, actionTemplate: object) => any;
export type RequestData = any;
export type Api = any;
export type ConnectionObject = any;

export interface IActionRequestData {
    connection: ConnectionObject;
    action: string;
    toProcess: boolean;
    toRender: boolean;
    messageCount: number;
    params: any;
    actionStartTime: number;
    response: any;
    attributes?: any;
}
export interface IActionMiddlewareRequestData extends IActionRequestData {
    missingParams: any[];
    validatorErrors: any[];
    actionTemplate: any; // the actual object action definition
    working: boolean;
    duration: any;
    actionStatus: any;
}

export interface IAction {
    run(api: object, data: IActionRequestData, next: ChainedFunction): void;
}

export interface IActionMiddleware {
    preProcessor?: (data: IActionMiddlewareRequestData, next: ChainedFunction) => void;
    postProcessor?: (data: IActionMiddlewareRequestData, next: ChainedFunction) => void;
}

export function Action(actionInfo: internal.IActionInfo) {
    // tslint:disable-next-line:ban-types
    return (constructor: Function) => {
        const runMethod = constructor.prototype.run;
        if (!constructor.prototype.run || !(constructor.prototype.run instanceof Function)) {
            throw new TypeError(`Action ${actionInfo.actionName} must implement the run method`);
        }
        if (getObjectType(constructor) !== ClassType.UNKNOWN) {
            throw new Error("@Action decorator cannot be applied here");
        }
        constructor.prototype.classType = ClassType.ACTION;
        Object.assign(constructor.prototype, actionInfo);
        SuperObjectEB.emit(SuperObjectEventType.ACTION_LOADED, constructor);
    };
}

export function Input(inputParam: internal.IInputParam) {
    const input: any = {};
    input.required = inputParam.required;
    if (inputParam.validator) {
        input.validator = inputParam.validator;
    }
    if (inputParam.formatter) {
        input.formatter = inputParam.formatter;
    }
    if (inputParam.default) {
        input["default"] = inputParam.default;
    }

    // tslint:disable-next-line:ban-types
    return (constructor: Function) => {
        if (!constructor.prototype.inputs) {
            constructor.prototype.inputs = {};
        }
        constructor.prototype.inputs[inputParam.name] = input;
    };
}

export function Options(actionOptions: internal.IActionOptions) {
    // tslint:disable-next-line:ban-types
    return (constructor: Function) => {
        if (actionOptions.logLevel) {
            constructor.prototype.logLevel = actionOptions.logLevel;
        }
        if (actionOptions.matchExtensionMimeType) {
            constructor.prototype.matchExtensionMimeType = actionOptions.matchExtensionMimeType;
        }
        if (actionOptions.toDocument) {
            constructor.prototype.toDocument = actionOptions.toDocument;
        }
    };
}

export function Route(routeInfo: internal.IRouteInfo) {
    // tslint:disable-next-line:ban-types
    return (constructor: Function) => {
        constructor.prototype.actionRoute = routeInfo;
    };
}

export function ActionMiddleware(actionMiddlewareInfo: internal.IActionMiddlewareInfo) {
    // tslint:disable-next-line:ban-types
    return (constructor: Function) => {
        if (getObjectType(constructor) !== ClassType.UNKNOWN) {
            throw new Error("@ActionMiddleware decorator cannot be applied here");
        }
        if ((typeof constructor.prototype.preProcessor !== "function") && (typeof constructor.prototype.postProcessor !== "function")) {
            throw new Error(`Middleware ${actionMiddlewareInfo.middlewareName} must implement atleast preProcessor or postProcessor`);
        }
        constructor.prototype.classType = ClassType.MIDDLEWARE;
        Object.assign(constructor.prototype, actionMiddlewareInfo);
        SuperObjectEB.emit(SuperObjectEventType.MIDDLEWARE_LOADED, constructor);
    };
}

const isClass = (func: any) => {
    return typeof func === "function"
        && /^class\s/.test(Function.prototype.toString.call(func));
};

export const setupInitilizer = (moduleVar: any) => {
    moduleVar.exports = {
        loadPriority: 600,
        initialize: (api: any, next: any) => {
            api.actions = api.actions.actions || {};
            api.actions.actions = api.actions.actions || {};
            api.actions.versions = api.actions.versions || {};

            api.actions.middleware = api.actions.middleware || {};
            api.actions.globalMiddleware = api.actions.globalMiddleware || [];

            const fail = (msg: string) => {
                return next(new Error(msg));
            };

            api.actions.validateSuperAction = (action: any) => {
                if (action.inputs === undefined) {
                    action.inputs = {};
                }
                if (api.connections !== null && api.connections.allowedVerbs.indexOf(action.name) >= 0) {
                    fail(action.name + " is a reserved verb for connections. choose a new name");
                    return false;
                } else {
                    return true;
                }
            };

            SuperObjectEB.on(SuperObjectEventType.ACTION_LOADED, (constructor: internal.IConstructable<internal.IActionInfo>) => {
                const action: internal.IActionInfo = new constructor();
                try {
                    if (action.version === null || action.version === undefined) { action.version = 1.0; }
                    if (api.actions.actions[action.actionName] === null || api.actions.actions[action.actionName] === undefined) {
                        api.actions.actions[action.actionName] = {};
                    }
                    api.actions.actions[action.actionName][action.version] = action;
                    if (api.actions.versions[action.actionName] === null || api.actions.versions[action.actionName] === undefined) {
                        api.actions.versions[action.actionName] = [];
                    }
                    api.actions.versions[action.actionName].push(action.version);
                    api.actions.versions[action.actionName].sort();
                    api.actions.validateSuperAction(api.actions.actions[action.actionName][action.version]);

                    // loadMessage(action);
                } catch (error) {
                    try {
                        delete api.actions.actions[action.actionName][action.version];
                        throw error;
                    } catch (err2) {
                        throw error;
                    }
                }
            });

            SuperObjectEB.on(SuperObjectEventType.MIDDLEWARE_LOADED, (constructor: internal.IConstructable<internal.IActionMiddlewareInfo>) => {
                const data: internal.IActionMiddlewareInfo = new constructor();
                if (!data.priority) { data.priority = api.config.general.defaultMiddlewarePriority; }
                data.priority = Number(data.priority);
                api.actions.middleware[data.middlewareName] = data;
                if (data.global && data.global === true) {
                    api.actions.globalMiddleware.push(data.middlewareName);
                    api.utils.sortGlobalMiddleware(api.actions.globalMiddleware, api.actions.middleware);
                }
            });

            api.config.general.paths.superObjects.forEach((p: any) => {
                api.utils.recursiveDirectoryGlob(p).forEach((f: string) => {
                    if (f.indexOf("SuperHero") !== -1) {
                        return;
                    }
                    const actionClasses = require(f);
                });
            });

            const data = {
                // tslint:disable:object-literal-key-quotes
                "name": "SH_Attributes_MW",
                "global": true,
                "priority": 0,
                // tslint:disable-next-line:no-shadowed-variable
                "preProcessor": (data: any, next: any) => {
                    data.attributes = {};
                    next();
                },
                // tslint:enable:object-literal-key-quotes
            };
            api.actions.middleware[data.name] = data;
            api.actions.globalMiddleware.push(data.name);
            api.utils.sortGlobalMiddleware(api.actions.globalMiddleware, api.actions.middleware);
            next();
        },
    };
};
