# Formula Expression Validator

An Excel-style formula editor for the Anvil expression language, built as a reusable Angular
component. It provides:

- **Autocomplete** for functions and fields (keyboard navigable, `Ctrl`/`Cmd`+`Space` to trigger)
- **Live validation** with inline error underlining and a diagnostics list
- **Function tooltips** (Excel-style signature hint that highlights the active argument)
- **Syntax highlighting** for functions, fields, numbers and operators

The demo app lives in `src/app` and the reusable pieces are under
[`src/app/formula`](src/app/formula):

| File | Purpose |
| --- | --- |
| `expression-catalog.ts` | Metadata for all ~80 expressions (signatures, params, arity, categories). |
| `formula-tokenizer.ts` | Tokenizes a formula string into positional tokens. |
| `formula-validator.service.ts` | Validation + autocomplete/argument-hint context. |
| `formula-editor.component.*` | The `<app-formula-editor>` UI component. |

---

## 1. Local setup

Prerequisites: **Node.js 18+** and **npm 9+** (Angular CLI 18 is used by this repo).

```bash
# Clone
git clone https://github.com/JSJan/FormulaExpressionValidator.git
cd FormulaExpressionValidator

# Install dependencies
npm install

# Run the dev server (http://localhost:4200)
npm start
```

Other useful scripts:

```bash
npm run build     # Production build into dist/
npm run watch     # Rebuild on change (development configuration)
npm test          # Run unit tests via Karma
```

### Using the component inside this app

```html
<app-formula-editor
  [(ngModel)]="formula"
  [fields]="fields"
  (validChange)="isValid = $event"
></app-formula-editor>
```

```ts
import { FormulaEditorComponent } from './formula/formula-editor.component';
import { FieldDef } from './formula/formula-validator.service';

fields: FieldDef[] = [
  { name: 'A1', unit: 'kWh', description: 'Scalar input A1' },
  { name: 'M2', unit: 'kWh', description: 'Metered series M2' },
];
```

Inputs / outputs:

| API | Type | Description |
| --- | --- | --- |
| `[fields]` | `FieldDef[]` | Fields/variables the user can reference. |
| `[placeholder]` | `string` | Input placeholder text. |
| `[(ngModel)]` | `string` | Two-way bound formula (implements `ControlValueAccessor`). |
| `(valueChange)` | `string` | Emits on every edit. |
| `(validChange)` | `boolean` | Emits `true` when there are no errors. |
| `(diagnosticsChange)` | `Diagnostic[]` | Emits the current validation diagnostics. |

---

## 2. Publishing as a reusable Angular package

The component is currently part of an application project. To share it with **other Angular
projects**, move the `formula` folder into an Angular **library** and publish it to npm (or a
private registry / GitHub Packages). The steps below convert this repo into a library workspace.

### Step 1 — Generate a library

```bash
ng generate library formula-editor --prefix fe
```

This creates `projects/formula-editor/` and registers it in `angular.json`.

### Step 2 — Move the reusable code into the library

Move everything the consumer needs (component, service, catalog, tokenizer) into the library's
`src/lib` folder and delete the generated sample files:

```bash
# From the repo root
rm projects/formula-editor/src/lib/formula-editor.*   # generated sample
cp -r src/app/formula/* projects/formula-editor/src/lib/
```

Keep only demo-specific code (the `AppComponent`) in `src/app`.

### Step 3 — Export the public API

Edit `projects/formula-editor/src/public-api.ts` so consumers can import the component and types:

```ts
export * from './lib/formula-editor.component';
export * from './lib/formula-validator.service';
export * from './lib/expression-catalog';
export * from './lib/formula-tokenizer';
```

> The component is already `standalone: true`, so no NgModule is required.

### Step 4 — Set library package metadata

Edit `projects/formula-editor/package.json`:

```jsonc
{
  "name": "@jsjan/formula-editor",
  "version": "0.1.0",
  "peerDependencies": {
    "@angular/common": "^18.0.0",
    "@angular/core": "^18.0.0",
    "@angular/forms": "^18.0.0"
  },
  "sideEffects": false
}
```

Use an npm **scope** (`@jsjan/...`) if you plan to publish to a personal/org scope or GitHub Packages.

### Step 5 — Build the library

```bash
ng build formula-editor
```

Output (an Angular Package Format bundle) is produced in `dist/formula-editor/`.

### Step 6 — Publish

**To the public npm registry:**

```bash
npm login
cd dist/formula-editor
npm publish --access public   # --access public is required for scoped packages
```

**To GitHub Packages (private/org):**

1. Add a `.npmrc` (do not commit tokens):
   ```
   @jsjan:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```
2. Set `"publishConfig": { "registry": "https://npm.pkg.github.com" }` in the library
   `package.json`.
3. `cd dist/formula-editor && npm publish`

### Step 7 — Consume it in another Angular project

```bash
npm install @jsjan/formula-editor
```

```ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormulaEditorComponent, FieldDef } from '@jsjan/formula-editor';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, FormulaEditorComponent],
  template: `
    <app-formula-editor [(ngModel)]="formula" [fields]="fields"></app-formula-editor>
  `,
})
export class AppComponent {
  formula = 'Add(A1, A2)';
  fields: FieldDef[] = [{ name: 'A1' }, { name: 'A2' }];
}
```

---

## 3. Alternatives to full npm publishing

If you don't want to publish to a registry yet:

- **Local tarball:** `cd dist/formula-editor && npm pack` produces a `.tgz` you can install in
  another project with `npm install ../path/to/jsjan-formula-editor-0.1.0.tgz`.
- **Git dependency:** commit the built library and install directly from the repo:
  `npm install github:JSJan/FormulaExpressionValidator#main`.
- **npm link (development):** run `npm link` inside `dist/formula-editor`, then `npm link
  @jsjan/formula-editor` in the consumer project for live local testing.

---

## Project structure

```
src/
  app/
    formula/                     # reusable component + logic
      expression-catalog.ts
      formula-tokenizer.ts
      formula-validator.service.ts
      formula-editor.component.ts|html|scss
    app.component.ts|html|scss   # demo page
```

Generated with [Angular CLI](https://github.com/angular/angular-cli) 18.
