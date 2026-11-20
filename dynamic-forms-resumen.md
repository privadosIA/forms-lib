# @core/dynamic-forms — workspace

Development workspace for **@core/dynamic-forms**, a standalone Angular library that renders reactive forms from JSON metadata (backend / Appian) on top of `@ngx-formly/core`. Consumers never touch Formly: they only deal with the contract in **`openspec.yaml`**, `provideDynamicForms()` and `<dynamic-form>`.

**Using the library?** Read the [library README](projects/dynamic-forms/README.md): schema format, field types, validation, conditional logic, amounts, component API and theming.

```
openspec.yaml                 ← formal contract (Schema, Validation, ConditionalLogic, ComponentAPI)
projects/dynamic-forms/       ← @core/dynamic-forms library (README, CHANGELOG)
projects/demo-showcase/       ← playground: five scenarios and a live schema editor
```

## Requirements

- Node.js `^20.19`, `^22.12` or `>=24` (CI runs on Node 22)
- Angular 21, `@ngx-formly/core` 10, TypeScript 5.9 (installed as dependencies). The library also supports Angular 22 + Formly 11 as peers; the specs pass on both, and the test host in `render-form.ts` sets `changeDetection: Default` because Angular 22 defaults to OnPush.

## Commands

```bash
npm install
npm start              # demo on http://localhost:4200 (uses the library sources, no build needed)
npm run build          # library (dist/dynamic-forms) + demo
npm run build:lib      # library only
npm run watch:lib      # library in watch mode
npm test               # unit tests (Vitest + jsdom)
npm run test:watch     # unit tests in watch mode
npm run test:ci        # unit tests with coverage (coverage/dynamic-forms)
npm run lint           # angular-eslint on the library and the demo
```

The demo imports the library from source through the tsconfig path alias `@core/dynamic-forms` → `projects/dynamic-forms/src/public-api.ts`.

## Tests

The library is tested with Vitest through `@angular/build:unit-test`, on jsdom, without a browser and without zone.js. Specs sit next to their sources as `*.spec.ts`:

- Pure logic: business validators, amount parsing and words, text length, list totals, table cells.
- Services: schema validator (including lists, totals, relative paths and tables), adapter (with a fake theme, no Formly components), condition evaluator, validator registry.
- Components: field types, the repeatable list (rows, table, limits, totals, relative rules) and the data table (formatting, filter, sort, paging, events, and rows loaded from a service with client or server paging) render a real `<dynamic-form>` through the `renderForm()` helper in `src/lib/testing/` (test-only, excluded from the build).

```bash
npx ng test dynamic-forms --watch=false --include=projects/dynamic-forms/src/lib/utils/currency.spec.ts  # one file
npx ng test dynamic-forms --watch=false --filter="currency"                                              # by test name
```

Because jsdom does not compute layout, visual changes are worth a look in the demo as well.

## Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request (no branch filter), on Node 22: `npm ci` → `npm run lint` → `npm run test:ci` → `npm run build`, and uploads the coverage report as an artifact. Gitea Actions reads the same file.

## Demo scenarios

The demo UI is in Spanish, like the library's messages.

1. **Campos dependientes** (dependent fields, `/dependientes`, `public/schemas/solicitud-dependiente.json`): `tipoSolicitante` shows/hides DNI/CIF/razón social (company name) and makes them required, with `resetOnHide`; provincia → municipio (`dependent`) → barrio (`remote` via `DemoOptionsProvider`); notification channel as a radio, with a postal address textarea limited to 250.
2. **Validación de negocio** (business validation, `/validacion`, `public/schemas/validacion-negocio.json`): `dniNie`, `iban`, `phoneES`, `matchesField` from the catalog; `mayorDeEdad` registered by the app with args; async `nifDisponible` (try `12345678Z`); `currency` amounts in euros (Spanish format) and in pounds (English format) with their amount in words; a textarea with a character counter.
3. **Esquema remoto** (remote schema, `/remoto`): the schema comes from `GET /api/forms/:id` instead of a static file, using `rxResource` with loading and error states. The backend is simulated by `mockBackendInterceptor` (`shared/mock-backend/`), which adds latency and answers 404 for unknown ids and 500 for `error` (it also serves the data of the tables scenario); remove it from `app.config.ts` to point at a real service.
4. **Listas repetibles** (repeatable lists, `/listas`, `public/schemas/listas-repetibles.json`): an order with a `table` list of lines (`minItems`/`maxItems`, a `currency` column, totals, and a motivo field required by `./cantidad` combined with a root rule) and a `rows` list of contacts, where the cargo field only shows in the row marked as principal.
5. **Tablas de datos** (data tables, `/tablas`, `public/schemas/tablas-datos.json`): the same expedientes table paginated in the client (`GET /api/expedientes` returns all 137 rows) and in the server (`GET /api/expedientes/paginado` answers `{ rows, total }` for each page, sort and search, with a form field as a `dependsOn` parameter), one whose service fails (error and retry), and one that reads its rows from the model (`dataKey`, with an `html: true` status badge and link column). Below them, a search form with a "Buscar" button above a server-paged results table (`source.externalParams` + `requireParams: false`, schemas `busqueda-criterios.json` and `busqueda-resultados.json`). The results table also has column filters, multiple selection that survives paging (`selectionKey`), CSV export and two frozen columns (`frozen`) a pin button in every header (`pinnableColumns`), draggable headers (`reorderableColumns`), resizable columns (`resizableColumns`), multi-column sorting (`multiSort`, Shift+click) and remembered state (`persistState`). `DemoTableProvider` turns the table's request into HTTP calls, answered by the mock backend (`shared/mock-backend/`). The page lists the `tableAction` and `tableSelect` events it receives.
6. **Editor en vivo** (live editor, `/editor`): edit a schema while it renders. The **Campos** tab has a tree of fields, groups, lists and tables (add, reorder, delete) and a property panel that is itself a `<dynamic-form>`; the **JSON** tab edits the full schema and applies it as you type; **Modelo** shows the form data. Invalid schemas list the validator's issues and the preview keeps the last valid version. Starts from the demo schemas, a catalog with one field of each type, or a blank form; the draft is kept in `localStorage`.

## Library architecture

```
src/lib/
  models/        schema.model.ts (SchemaContract in TS) · config.model.ts (public API)
  tokens/        DYNAMIC_FORMS_CONFIG · DF_VALIDATORS (multi) · DF_OPTIONS_PROVIDER · DF_TABLE_PROVIDER
  providers/     provideDynamicForms() · built-in messages
  services/
    form-schema-adapter.service.ts   JSON → FormlyFieldConfig[] (validates, sanitizes, maps theme, logic, cascades)
    schema-validator.service.ts      structural validation of the contract (no ajv)
    condition-evaluator.service.ts   all/any/not rules + operators, no eval; ./field paths read the current row of a list
    validator-registry.service.ts    validator catalog by alias
  validators/    DNI, NIE, CIF, IBAN, phone, postal code, matchesField (pure functions + catalog)
  utils/         amounts (parse, format, words) · text length · CSS lengths · totals of repeatable lists · table cells (format, filter, sort)
  directives/    dfMaxLength (blocks input at maxLength, weighted count)
  themes/        PLAIN_THEME · materialTheme() · bootstrapTheme()
  types/<type>/  Formly components (separate ts + html + scss); repeat-field (df-repeat, `array` nodes) and table-field (df-table, `table` nodes) are in every theme
  wrappers/      df-field (label/errors) · df-group (fieldset)
  dynamic-form/  <dynamic-form> facade
  testing/       renderForm() helper for the specs (not part of the build)
src/styles/      _tokens · _grid (12 col) · _control-base · plain · material · bootstrap
```

Flow: `schema` → `SchemaValidatorService` → `sanitize()` → `FormlyFieldConfig[]` → `<formly-form>`. The adapter is the only part of the library that knows Formly in depth.

## Publishing

The library can be published to any npm registry. These steps use a Gitea registry (`https://<gitea-host>/api/packages/<owner>/npm/`) as the example. The registry never overwrites an existing version, so bump the version first (see Contributing).

```bash
npm run build:lib
cd dist/dynamic-forms && npm publish
```

Publishing needs a Gitea token with `write:package`, stored in `~/.npmrc` (never in the repo):

```
@core:registry=https://<gitea-host>/api/packages/<owner>/npm/
//<gitea-host>/api/packages/<owner>/npm/:_authToken=<token>
```

Consumers add the same two lines (a token with `read:package` is enough) and then run `npm install @core/dynamic-forms`.

## Contributing

- **Contract changes** go together: both copies of `openspec.yaml` (repo root and workspace, byte-identical), `src/lib/models/schema.model.ts` (the TypeScript mirror) and `services/schema-validator.service.ts`.
- **Versioning:** the library version in `projects/dynamic-forms/package.json` must match `info.version` in `openspec.yaml`. User-facing changes go in `projects/dynamic-forms/CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)); breaking changes need a major bump and a migration note.
- **Language:** documentation (READMEs, CHANGELOG, contract prose) is in English. Code, comments, user-facing messages and the demo are in Spanish.
- `dynamic-forms-resumen.md` at the repo root is a copy of this README; keep them identical.
- Run `npm run lint`, `npm test` and `npm run build` before pushing; CI runs the same steps.

## License

Apache-2.0 — Copyright (c) 2026 Jesús Suero
