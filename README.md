# ActionSuperHero

Typescript decorators for working with actionhero framework.


## Getting Started

`npm install actionsuperhero`

### Setup Typescript compiler

Alter `tsconfig.json` to support decorators and emit node modules (unlike ES6 modules)
```json
"compilerOptions": {
        "module": "none",
        "target": "es6",
        "noImplicitAny": true,
        "inlineSourceMap": true,
        "noImplicitReturns": true,
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "outDir": "dist",
        "sourceRoot": "src",
        "moduleResolution": "node"
    }
```

### Config action path

Edit `config/api.js` and add the following to the `paths` array 
```javascript
paths: [
...
'superObjects': [path.join(__dirname, '/../dist')]
...
],
```

### Setup initializer
Create a file `actionsuperhero.js` under the initializers directory of your actionhero project, with the following  content

```typescript
'use strict'

const actionsuperhero = require("actionsuperhero");

actionsuperhero.setupInitializer(module);
```

### Hello World Action
Create a file `HelloWorld.ts` under the `src` directory with the following content

```typescript
import {Action, Api, ChainedFunction, IAction, IActionRequestData, Input} from "actionsuperhero";

@Action({
    actionName: "helloworld",
    description: "Just says hello world",
})
@Input({
    name: "user",
    required: false,
})
export class HelloWorld implements IAction {
    public run(api: Api, data: IActionRequestData, next: ChainedFunction): void {
        const name = data.params.user || "World";
        data.response.message = `Hello ${name}`;
        next();
    }
}
```
