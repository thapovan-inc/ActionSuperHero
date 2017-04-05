"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const SuperObjectEB = new events_1.EventEmitter();
var ClassType;
(function (ClassType) {
    ClassType[ClassType["ACTION"] = 0] = "ACTION";
    ClassType[ClassType["MIDDLEWARE"] = 1] = "MIDDLEWARE";
    ClassType[ClassType["UNKNOWN"] = 2] = "UNKNOWN";
})(ClassType || (ClassType = {}));
const SuperObjectEventType = {
    ACTION_LOADED: "ACTION_LOADED",
    MIDDLEWARE_LOADED: "MIDDLEWARE_LOADED",
};
// tslint:disable-next-line:ban-types
function getObjectType(constructor) {
    if (constructor.prototype && constructor.prototype.classType) {
        return constructor.prototype.classType;
    }
    else {
        return ClassType.UNKNOWN;
    }
}
function Action(actionInfo) {
    // tslint:disable-next-line:ban-types
    return (constructor) => {
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
exports.Action = Action;
function Input(inputParam) {
    const input = {};
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
    return (constructor) => {
        if (!constructor.prototype.inputs) {
            constructor.prototype.inputs = {};
        }
        constructor.prototype.inputs[inputParam.name] = input;
    };
}
exports.Input = Input;
function Options(actionOptions) {
    // tslint:disable-next-line:ban-types
    return (constructor) => {
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
exports.Options = Options;
function Route(routeInfo) {
    // tslint:disable-next-line:ban-types
    return (constructor) => {
        constructor.prototype.actionRoute = routeInfo;
    };
}
exports.Route = Route;
function ActionMiddleware(actionMiddlewareInfo) {
    // tslint:disable-next-line:ban-types
    return (constructor) => {
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
exports.ActionMiddleware = ActionMiddleware;
const isClass = (func) => {
    return typeof func === "function"
        && /^class\s/.test(Function.prototype.toString.call(func));
};
exports.setupInitilizer = (moduleVar) => {
    moduleVar.exports = {
        loadPriority: 600,
        initialize: (api, next) => {
            api.actions = api.actions.actions || {};
            api.actions.actions = api.actions.actions || {};
            api.actions.versions = api.actions.versions || {};
            api.actions.middleware = api.actions.middleware || {};
            api.actions.globalMiddleware = api.actions.globalMiddleware || [];
            const fail = (msg) => {
                return next(new Error(msg));
            };
            api.actions.validateSuperAction = (action) => {
                if (action.inputs === undefined) {
                    action.inputs = {};
                }
                if (api.connections !== null && api.connections.allowedVerbs.indexOf(action.name) >= 0) {
                    fail(action.name + " is a reserved verb for connections. choose a new name");
                    return false;
                }
                else {
                    return true;
                }
            };
            SuperObjectEB.on(SuperObjectEventType.ACTION_LOADED, (constructor) => {
                const action = new constructor();
                try {
                    if (action.version === null || action.version === undefined) {
                        action.version = 1.0;
                    }
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
                }
                catch (error) {
                    try {
                        delete api.actions.actions[action.actionName][action.version];
                        throw error;
                    }
                    catch (err2) {
                        throw error;
                    }
                }
            });
            SuperObjectEB.on(SuperObjectEventType.MIDDLEWARE_LOADED, (constructor) => {
                const data = new constructor();
                if (!data.priority) {
                    data.priority = api.config.general.defaultMiddlewarePriority;
                }
                data.priority = Number(data.priority);
                api.actions.middleware[data.middlewareName] = data;
                if (data.global && data.global === true) {
                    api.actions.globalMiddleware.push(data.middlewareName);
                    api.utils.sortGlobalMiddleware(api.actions.globalMiddleware, api.actions.middleware);
                }
            });
            api.config.general.paths.superObjects.forEach((p) => {
                api.utils.recursiveDirectoryGlob(p).forEach((f) => {
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
                "preProcessor": (data, next) => {
                    data.attributes = {};
                    next();
                },
            };
            api.actions.middleware[data.name] = data;
            api.actions.globalMiddleware.push(data.name);
            api.utils.sortGlobalMiddleware(api.actions.globalMiddleware, api.actions.middleware);
            next();
        },
    };
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3VwZXJIZXJvLmpzIiwic291cmNlUm9vdCI6Ii9Vc2Vycy9zcmlyYW0vUHJvamVjdHMvU3VwZXJIZXJvL3NyYy8iLCJzb3VyY2VzIjpbIlN1cGVySGVyby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG1DQUFzQztBQXNDdEMsTUFBTSxhQUFhLEdBQUcsSUFBSSxxQkFBWSxFQUFFLENBQUM7QUFFekMsSUFBSyxTQUVKO0FBRkQsV0FBSyxTQUFTO0lBQ1YsNkNBQU0sQ0FBQTtJQUFFLHFEQUFVLENBQUE7SUFBRSwrQ0FBTyxDQUFBO0FBQy9CLENBQUMsRUFGSSxTQUFTLEtBQVQsU0FBUyxRQUViO0FBRUQsTUFBTSxvQkFBb0IsR0FBRztJQUN6QixhQUFhLEVBQUUsZUFBZTtJQUM5QixpQkFBaUIsRUFBRyxtQkFBbUI7Q0FDMUMsQ0FBQztBQUVGLHFDQUFxQztBQUNyQyx1QkFBdUIsV0FBcUI7SUFDeEMsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDM0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDO0lBQzNDLENBQUM7SUFBQyxJQUFJLENBQUMsQ0FBQztRQUNKLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO0lBQzdCLENBQUM7QUFDTCxDQUFDO0FBdUNELGdCQUF1QixVQUF1QjtJQUMxQyxxQ0FBcUM7SUFDckMsTUFBTSxDQUFDLENBQUMsV0FBcUI7UUFDekIsTUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUM7UUFDNUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLFlBQVksUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pGLE1BQU0sSUFBSSxTQUFTLENBQUMsVUFBVSxVQUFV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QUFJLFdBQVcsRUFBRSxDQUFDO2dCQUM5QyxJQUFJLENBQUM7b0JBQ0QsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sS0FBSyxJQUFJLElBQUksTUFBTSxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDO3dCQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDO29CQUFDLENBQUM7b0JBQ3RGLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxJQUFJLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUM7d0JBQzFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQ2hELENBQUM7b0JBQ0QsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxNQUFNLENBQUM7b0JBQ2hFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxJQUFJLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUM7d0JBQzVHLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQ2pELENBQUM7b0JBQ0QsR0FBRyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQzdELEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0s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