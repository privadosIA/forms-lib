# Changelog

All notable changes to `@core/dynamic-forms` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the library uses
[semantic versioning](https://semver.org/). The contract version (`info.version` in
`openspec.yaml`) is the same as the library version.

## [2.19.1] - 2026-10-21

### Fixed

- Changing the schema and the `[context]` of `<dynamic-form>` in the same change-detection pass threw
  `Cannot read properties of undefined (reading 'checkExpressions')`: the context effect called
  `options.detectChanges` on a root field that Formly had not built yet. It now skips that call, because the new
  fields read the new context when they are built.

## [2.19.0] - 2026-10-21

### Added

- **`selectAll(tableId?)` and `clearSelection(tableId?)`** on `<dynamic-form>`, for your own buttons outside the
  table. `selectAll` ticks what the header checkbox would tick (the filtered rows that pass `selectableWhen`; in
  `server` mode, the page's rows) and `clearSelection` empties the whole selection, other pages included. Both only
  act on `selectable: "multiple"` tables (`clearSelection` also releases a single selection), without `tableId` they
  act on every table, and both emit `tableSelect` with `changed` (nothing is emitted when nothing changes).

## [2.18.0] - 2026-10-21

### Added

- **`tableSelect.changed`**: `{ rows, selected }` says which rows the event ticked (`selected: true`) or unticked
  (`false`), in any selection mode: one row on a click, the range of a Shift+click, the rows moved by the header
  checkbox, or the rows lost when the table reloads. `row` and `rows` are unchanged (`row` is still `null` in
  multiple selection), so existing code keeps working.

## [2.17.0] - 2026-10-21

### Added

- **`FormSchemaAdapterService.registerOptionsProvider(provider)`** registers or replaces the `remote` options source at
  run time (it clears the options cache), for apps that provide `provideDynamicForms` per route and so can't reach
  the root-level service with `DF_OPTIONS_PROVIDER`.
- **`slot` nodes.** `{ "type": "slot", "name": "summary" }` reserves a place between fields for your own template:
  `<ng-template dfSlot="summary" let-model>` inside `<dynamic-form>`. No key, no control, nothing in the model; it
  takes the whole row, supports `logic` and `cssClass`, and can be at the root or in a group (not in a list). New
  exports: `DfSlot`, `isDfSlot`, `DfSlotDirective`, `DfSlotContext`, `SlotFieldComponent`.
- **External context for conditions.** `<dynamic-form [context]="{ mode: 'edit' }">` and rules on `ctx.mode` (in
  `showWhen`, `hideWhen`, `requiredWhen`, `disabledWhen`, and the row rules of tables). Changing the object
  re-evaluates the conditions. The validator accepts any name after `ctx.`.

- **`layout.resetOnHide`**: schema-wide default for `logic.resetOnHide` (precedence: the node's own, then the
  schema's, then `defaultResetOnHide`).

### Changed

- `DfNode` now includes `DfSlot`. TypeScript code that reads `node.key` after excluding groups, lists and tables
  must also exclude slots (`isDfSlot`); `isDfField` already does.
- The field key `ctx` (or `ctx.…`) is reserved for the external context and is now a schema error.

## [2.16.0] - 2026-10-21

### Added

- **Your own cells and empty state.** Columns accept `template: "name"`, drawn by an application
  `<ng-template dfCell="name" let-row let-value="value">` inside `<dynamic-form>`; `<ng-template dfEmpty="tableId">`
  replaces `emptyMessage` for an empty table. New exports: `DfCellDirective`, `DfEmptyDirective`, `DfCellContext`.
  Filtering, sorting and the CSV keep using the column value.
- **Conditional row selection.** `selectableWhen` (a condition on the row) limits which rows can be selected: the
  others have a disabled checkbox and ignore clicks, and the header checkbox skips them. `headerSelects: "page"` makes
  the header checkbox tick only the visible page instead of every filtered row.
- **`badge` and `link` column types.** `badge` draws a coloured pill from `map` (text) and `variants` (`ok`, `warn`,
  `error`, `info`) and filters with a drop-down; `link` draws a link to `href` (`/runs/{id}`, values from the row,
  URL-encoded; only `/`, `#`, `http(s)://` destinations). No HTML strings needed in the rows.
- **`tableNavigate` output.** A click on a `link` cell emits `{ tableId, column, href, row, originalEvent }`; call
  `originalEvent.preventDefault()` and navigate with your router to avoid a page reload.
- **Row actions with icon, tooltip and conditions.** `table.actions[]` accepts `icon` (a built-in name such as `view`,
  `edit`, `delete`, `download`, `add`, `check`, `close`, or any short text), `tooltip`, `showWhen` and `disabledWhen`
  (conditions on the row: `./field` reads the row). A hidden or disabled action does not emit `tableAction`.

## [2.15.0] - 2026-10-21

### Added

- **Types without the theme's field wrapper.** A type registered with `provideDynamicForms({ types })` and
  `wrappers: []` (or its own list) is rendered with those wrappers instead of the theme's `fieldWrappers`, so block
  types no longer fail with `mat-form-field must contain a MatFormFieldControl`. `DfTheme.typeWrappers` does the same
  per contract type (`{ checkbox: [] }`); it wins over the wrappers a UI package declares on its own types.
- **`revalidate()`** on `<dynamic-form>` re-runs the validators of every control (`markAllAsTouched()` only
  revalidated the group), for validators that read state outside the form.
- **`showErrors` input** (`'touched'` by default, or `'always'`): with `'always'` errors show from the moment a field
  exists, so fields that appear later no longer wait to be touched.
- **`searchKeys` on tables**: extra row keys the search box also looks at, even when they are not visible columns
  (client mode).
- **English texts.** `EN_VALIDATION_MESSAGES` and `EN_TABLE_TEXTS` are complete English sets for the built-in
  validation messages and the fixed table texts: `provideDynamicForms({ messages: EN_VALIDATION_MESSAGES,
  tableTexts: EN_TABLE_TEXTS })`. Boolean cells (`Sí`/`No`) are still Spanish.

### Changed

- **Material: `checkbox` and `radio` are no longer inside a `mat-form-field`.** They are not a `MatFormFieldControl`,
  so they came out in an outlined box. `materialTheme()` now renders them with the library's `df-field` wrapper (label
  of the radio group, description and error text) and the checkbox draws its own label. The Material theme registers
  `df-field` for this. To get the old rendering back: `materialTheme(providers, { typeWrappers: {}, typeProps: { multiselect: { multiple: true } } })`.
- A group's `cssClass` is now also set on the `fieldset.df-group` (it was only on the grid cell around it), so the
  frame can be styled with `.my-class.df-group`. The class on the grid cell stays, so existing selectors keep working.

## [2.14.1] - 2026-10-21

### Changed

- Documentation only: a "Good to know" section in the library README covers behaviour that was only visible in the
  source (the model is edited in place, replacing `model` vs `schema`, `props.min`/`props.max` validators,
  empty-value shapes, remote option caching, root-level registration, selection event shape).

## [2.14.0] - 2026-10-21

### Added

- **Angular 22 and Formly 11.** The peer dependencies now accept `@angular/{core,common,forms}` `^21.0.0 || ^22.0.0`
  and `@ngx-formly/core` `^10.0.0 || ^11.0.0` (Formly 10 needs Angular 21, Formly 11 needs Angular 22). The test suite
  passes on both combinations; no runtime code changed. `@ngx-formly/material` and `@ngx-formly/bootstrap` must be on
  the same major as `@ngx-formly/core`.

### Fixed

- `materialTheme()`, `bootstrapTheme()` and `DfTheme.providers` accept `EnvironmentProviders`, so
  `materialTheme([importProvidersFrom(FormlyMaterialModule)])` type-checks as documented (it needed a cast before).
- The theme stylesheets declare the `--df-*` tokens with zero specificity (`:where()`). A plain
  `.df-form { --df-color-primary: … }` in the app now wins over the Material and Bootstrap themes, with no
  `.df-form.df-form` workaround and regardless of stylesheet order.

## [2.13.0] - 2026-10-20

### Added

- **HTML cells.** `columns[].html: true` renders a `text` column as HTML instead of plain text, for links and status
  badges. The HTML goes through Angular's sanitizer (no scripts, `on*` handlers, `style` or `javascript:` URLs), and
  the column filter, the sort and the CSV export use the text without tags. The themes ship `df-badge` styles:
  `<span class="df-badge df-badge--ok|warn|error|info">`. Off by default; only use it with HTML you trust to be
  links and badges, since a sanitized link can still point somewhere misleading.

## [2.12.1] - 2026-10-20

### Changed

- No code changes. The development guide now documents how to publish the library to an npm registry; the
  package itself is identical to 2.12.0.

## [2.12.0] - 2026-10-20

### Changed

- The 12-column grid now stacks fields with a container query on the form's own width (below 640 px) instead of a
  viewport media query, so a form inside a narrow panel stacks too.
- Repeatable lists with `display: "table"` turn each row into a card with stacked cells in a narrow container
  (below 640 px), showing each column's label above its field. Between that and the full table layout they keep a
  minimum width (9rem per column) and scroll horizontally.

## [2.11.0] - 2026-10-20

### Added

- **Multi-column sorting.** `multiSort: true`: Shift + click on a header adds that column to the order (or flips
  its direction, and a third time removes it); a click without Shift sorts by that column alone. The first
  column rules and each next one breaks the ties of the previous. With several, each header shows its position.
  `sort` in the schema can be a list for the initial order (it needs `multiSort`). `persistState` remembers
  the whole order. Without `multiSort` nothing changes.
- `request.sorts` in `DfTableRequest`: the whole order, from the main column to the last tiebreak (`[]` in
  `client` mode). `request.sort` is still its first element, or `null`, so existing providers keep working;
  a provider that wants several columns reads `sorts`.

### Changed

- The state saved by `persistState` keeps the sort as `sorts` (a list). Entries saved by 2.8 to 2.10 with the
  old `sort` field are still read.

## [2.10.0] - 2026-10-20

### Added

- **Resizable columns.** `resizableColumns: true` puts a handle on the right edge of every header: drag it to
  change the width of that column, or use the left/right arrows when it has the focus (10 px, 50 with Shift);
  a double click restores the widths of the schema. From the first change all widths become pixels (the table
  keeps them as they were, so only the dragged column changes) and the table scrolls horizontally when it does
  not fit. The minimum width is 48 px. `persistState` also remembers the widths (they are ignored if a column
  was added or removed since). The handle label is the new `resizeColumn` entry of `tableTexts`.

## [2.9.0] - 2026-10-20

### Added

- **Reorderable columns.** `reorderableColumns: true` lets the user drag a header onto another to change the
  order of the columns, or press Alt + left/right arrow on a focused header. A frozen column only moves among
  the frozen ones and a normal column among the normal ones. With `pinnableColumns`, a released column returns
  to its place in the order the user chose. `persistState` also remembers the order (columns that no longer
  exist are ignored and new ones go last). The hint text is the new `reorderHint` entry of `tableTexts`. The CSV
  export follows the order on screen.

## [2.8.0] - 2026-10-20

### Added

- **Table state between visits.** `persistState: true` (or `"session"`) keeps the sort, the search box, the
  column filters, the rows per page and the pinned columns in `sessionStorage`; `"local"` uses
  `localStorage`. `stateKey` names the entry (default: the table `id`, under `df-table:`). What is read back
  is checked against the current columns and options, so a stale entry is ignored instead of breaking the
  table, and a sort the user cleared wins over the schema's initial `sort`. In `server` mode the first request
  already carries the restored search and filters. The page and the selection are not saved.

## [2.7.0] - 2026-10-20

### Added

- **Range selection with Shift.** With `selectable: "multiple"`, Shift+click on a row (or its checkbox) ticks
  every row of the page between the last one clicked and this one, keeping what was already ticked. Without
  a starting row, or after changing page, it ticks just that row. No schema change.

## [2.6.0] - 2026-10-20

### Added

- **Columns the user can freeze.** `pinnableColumns: true` puts a pin button in every column header. A column
  that is frozen moves to the end of the frozen block and goes back to its place when released. It starts from
  `columns[].frozen`, and the choice is kept only while the table is on screen (not in the model). The button
  labels are the new `pinColumn` and `unpinColumn` entries of `tableTexts`. The CSV export follows the order
  on screen.

## [2.5.0] - 2026-10-20

### Added

- **Frozen columns.** `columns[].frozen: true` keeps a column fixed on the left while the table scrolls
  horizontally; with multiple selection the checkbox column is fixed as well. Only the first columns can be
  frozen (the validator rejects a frozen column after one that is not).
- **Translatable table texts.** `provideDynamicForms({ tableTexts })` replaces the fixed texts of the tables
  ("Buscar", "Filas por página", "Acciones", "Exportar CSV", the pager, the filters, the accessible labels…).
  What you leave out stays in Spanish. Texts with placeholders (`{from}`, `{to}`, `{total}`, `{text}`,
  `{label}`, `{n}`) get them filled in. `emptyMessage`, `errorMessage` and `filterLabel` in the schema still
  win over the global texts. The new `DfTableTexts` type lists them all.

## [2.4.0] - 2026-10-20

### Added

- **Multiple selection in tables.** `selectable: "multiple"` adds a checkbox column and a header checkbox
  that ticks every filtered row (in `server` mode, the rows of the page). `selectable: true` or `"single"`
  keeps the one-row selection. `selectionKey` names the row property that identifies a row, so that in
  `server` mode the selection survives a change of page, sort or filter; without it those changes clear the
  selection.
- **Column filters.** `columns[].filter: true` shows a filter under the header: a text box (contains, case
  and accent insensitive) or a drop-down for `map` and `boolean` columns. They combine with each other and
  with the table search. In `server` mode they reach the service in the new `request.columnFilters`
  (column key → text, or the `map` key / `"true"` / `"false"`), without the empty ones.
- **CSV export.** `exportCsv: true` (or `{ filename }`) adds an "Exportar CSV" button that downloads what the
  user sees: every filtered and sorted row, with amounts and dates formatted, `;` as separator, UTF-8 with
  BOM so Excel keeps the accents, and values that Excel would read as a formula prefixed with `'`. With rows
  ticked (multiple selection) it exports only those and says so in the button. In `server` mode it asks the
  `DfTableProvider` for every row of the current search (`page: 0`, `pageSize` = the total).

### Changed

- `tableSelect` now carries `rows`, the whole selection: `{ tableId, row, rows }`. In single selection `row`
  works as before; in multiple selection `row` is `null`.
- `DfTableRequest` has a new `columnFilters` field (`{}` in `client` mode). Providers that ignore it keep
  working, but they will return unfiltered rows in `server` mode if the schema uses column filters.

## [2.3.0] - 2026-10-20

### Added

- **Search form + table with a button.** `table.source` has two new options. `externalParams: true` lets
  `dependsOn` name keys of the root model that are not fields of the schema, so a table can live in its own
  `<dynamic-form>` whose model the app fills (for example with `event.model` from the `formSubmit` of a
  search form, which only fires when it is valid). Replacing the model reloads the table from the first
  page. `requireParams: false` loads the table even when a `dependsOn` value is empty, for optional search
  criteria; the empty values go in `request.params` as they are. Both default to the previous behaviour.
- The `/tablas` demo shows it: a criteria form with a "Buscar" button above a server-paged results table.

## [2.2.0] - 2026-10-19

### Added

- **Data tables (`type: "table"`).** A read-only table node, not a form field: it has no `key` and writes
  nothing to the model. The rows are inline (`rows`) or read from a model property (`dataKey`, a dotted
  path, which can arrive or change after the form is rendered). It has typed columns (`text`, `number`,
  `currency`, `date`, `datetime`, `boolean` and `map`), a search box that matches the text the user sees
  without regard to case or accents (`filter`), sorting by clicking the headers (dates and amounts sort by
  value; empty cells go last), paging (`pageSize`, `pageSizeOptions`), an initial `sort`, a per-row
  button list (`actions`), single row selection (`selectable`) and an `emptyMessage`. It supports
  `logic.showWhen` / `hideWhen`. Every theme renders it with the library's own `df-table` component.
- **Rows from a service (`source`).** `source: { endpoint, mode, dependsOn }` loads the rows through the
  app's new `DfTableProvider` (`provideDynamicForms({ tableProvider })`, token `DF_TABLE_PROVIDER`).
  With `mode: "client"` (default) the service returns every row and the table filters, sorts and pages
  them locally; with `mode: "server"` it returns one `{ rows, total }` page per request, with the page,
  size, sort and search (debounced 300 ms) the user chose, and `pageSize` is required. `dependsOn` sends
  form fields as `params` and reloads the table from the first page when they change (`./field` works
  inside a repeatable list). It shows a loading state and an error with a retry button
  (`errorMessage`), discards the response of a replaced request and clears the selection on reload.
- **Events.** `<dynamic-form>` has two new outputs: `tableAction` (`{ tableId, action, row }`) and
  `tableSelect` (`{ tableId, row }`, with `row` null when the selection is cleared).
- New public exports: `DfTable`, `DfTableSource`, `DfTableProvider`, `DfTableRequest`, `DfTablePage`, `DF_TABLE_PROVIDER`, `DfTableColumn`, `DfTableColumnType`, `DfTableAction`, `DfTableSort`,
  `DfTableActionEvent`, `DfTableSelectEvent`, `DF_TABLE_COLUMN_TYPES`, `isDfTable` and `TableFieldComponent`.
- `SchemaValidatorService` checks tables: `id`, columns (repeated keys, types, `map`, `col`, `currency`),
  `sort`, paging, `rows`, `dataKey`, `source` (endpoint, mode, `dependsOn`, no mixing with `rows` or `dataKey`) and `actions`. `isDfField()` now also excludes tables.
- The live editor in the demo edits tables (service, paging mode, columns and actions) and the demo has two new scenarios.

## [2.1.0] - 2026-10-19

### Added

- **Repeatable lists (`type: "array"`).** A new node holds a list of rows: the model stores
  `key: [{...}, {...}]`, one object per row with the node's `fields`, and the user adds and removes rows
  with buttons. It supports `minItems` and `maxItems` (validation errors `minItems` and `maxItems`, with
  Spanish messages), `itemLabel`, `addLabel`, `removeLabel`, `columns`, `cssClass` and `logic`.
- **Two displays.** `display: "rows"` (default) renders one card per row. `display: "table"` renders a
  header with the field labels and one line per row; the `layout.col` of each field is the relative
  width of its column. In a table, fields cannot be hidden and groups are not allowed, so the columns
  stay aligned.
- **Relative paths in rules.** Inside an array row, a condition can read another field of the same
  row with `./field` (`{ "field": "./quantity", "operator": "gt", "value": 10 }`). Absolute keys keep
  reading the form's root. `ConditionEvaluatorService.evaluate()` takes an optional third argument,
  the row model.
- **Totals.** `totals: [{ label, op, field }]` on an array shows `sum`, `count`, `avg`, `min` or `max`
  of a `number` or `currency` field below the rows, recalculated on every change. A `currency` field's
  total uses its currency and number format. They are display only and are not stored in the model.
- **Relative `dependsOn`.** In `options` (`dependent` and `remote`), `./field` points to a field of the
  same row; changing it resets the child field of that row.
- New public exports: `DfArray`, `DfArrayTotal`, `DfArrayTotalOp`, `DfArrayDisplay`, `DF_ARRAY_TOTAL_OPS`,
  `isDfArray`, `isDfField`, `formatNumber` and `RepeatFieldComponent` (`df-repeat`, registered by every theme).
- `SchemaValidatorService` checks arrays: key, `display`, `columns`, `minItems`/`maxItems`, nested arrays,
  the table restrictions, the totals and that every `./field` exists in its row.

## [2.0.0] - 2026-10-14

### Breaking changes

- **Angular 21 and Formly 10.** The `peerDependencies` move to `@angular/common`, `@angular/core` and
  `@angular/forms` `^21.0.0` and `@ngx-formly/core` `^10.0.0`. If you use `materialTheme()` or
  `bootstrapTheme()`, `@ngx-formly/material` or `@ngx-formly/bootstrap` must also be on 10
  (with `@angular/material` ≥ 21 or `bootstrap` 5).
- **Length error key.** The `validation.minLength` and `validation.maxLength` errors are now named
  `minLength` and `maxLength` on the `FormControl` (previously `minlength` and `maxlength`), following
  the Formly 6+ convention. The contract (`ValidationContract.builtIn`) reflects the change.
- **`statusChange` emits on mount.** `<dynamic-form>` emits the initial status (`VALID` or `INVALID`) when
  the form is built, without waiting for any interaction. Previously, a valid form emitted nothing
  until the first change.
- **`type: email` fields validate the format.** The contract already promised it (`builtIn.email`), but it
  was not applied: any text was accepted as valid. Now a malformed email marks the field as invalid
  with the message `Debe ser un email válido`. An empty value is still valid.
- **Stricter schema validation.** `SchemaValidatorService` now rejects schemas that the contract
  already declared invalid but that used to pass:
  - conditions without `value`, except with `empty`, `notEmpty`, `truthy` and `falsy` (`null` is accepted);
  - `static` options without `items`, `dependent` without `map` and `remote` without `endpoint`;
  - `layout.columns` outside 1–12 and `layout.gap` that is not a simple CSS length (`1rem`, `12px`…).

  With `strictSchema` (enabled by default) these schemas throw `DynamicFormsSchemaError`.
- **`maxLength` counts ñ and accented letters as 2.** By default (`maxLengthMode: 'weighted'`) every non-ASCII
  character (ñ, á, ü, €…) counts as 2 for validation, input blocking and the counter, because the backend
  measures the limit in bytes. A text that used to fit may now exceed it. To count characters, use
  `provideDynamicForms({ maxLengthMode: 'chars' })` or `props.maxLengthMode` on the field.
- **Props starting with `on`.** Sanitization drops any prop whose name starts with `on`,
  case-insensitively (previously only `onX` with an uppercase letter, so `onclick` got through). This includes
  legitimate names such as `onlyDigits`: rename them.

- **One field per row by default.** `layout.columns` and group `columns` now default to 1
  (previously 12). With 12, a field without `layout.col` took 1/12 of the width, so a schema without `columns`
  rendered tiny fields. If any schema relied on the previous value, set `columns` explicitly.

### Added

- **`currency` type.** An amount in any currency, in Spanish format (`1.500,75`) or English format
  (`1,500.75`): thousands separator in groups of 3, up to 2
  decimals, no negatives and no inner spaces. The model stores a `number`; on blur it is formatted
  as currency (`1.500,75 €`, `£1,500.75`) and the amount in words is written below it, in Spanish or English
  (`MIL QUINIENTOS EUROS…`, `VEINTIUNA LIBRAS`, `ONE THOUSAND … POUNDS`). Currency, format, words language,
  uppercase and words on/off are configured app-wide with `provideDynamicForms({ currency })` and per field with
  props. Names included for EUR, GBP and USD; other currencies via `currencyWords`. New built-in messages
  `currencyFormat` and `currencyDecimals`. `parseAmount`, `formatAmount` and `amountToWords` are exported. In
  Material and Bootstrap it renders as a text input with the same validation.
- **Character counter in `textarea`.** With `validation.maxLength`, `N/max` appears below the box, turning red
  when the limit is reached, and screen readers are notified. The browser does not let you type or paste beyond it.
- **Custom types in the schema.** Types registered with `provideDynamicForms({ types })` can be used
  in `type`, as the contract already said; previously the validator rejected them. In TypeScript, `DfField.type`
  accepts `DfFieldType | DfCustomFieldType`.
- **`layout.gap`** is applied as the form's `--df-grid-gap` CSS variable. It was previously in the
  contract but did nothing.

### Fixed

- **Empty `select`:** a select with no value in the model rendered blank instead of showing its placeholder
  ("— Selecciona —"), because the placeholder option was bound to `null` and the model held `undefined`.
- **Placeholders in `validation.messages`:** `{{label}}`, `{{minLength}}`… are resolved with the field's
  props and the `args` of the validator with the same name, as the contract says. Previously they were shown verbatim.
- **`dependent` options without `map`:** in non-strict mode, the form no longer throws a `TypeError` when the
  parent field has a value; the child is left without options. Same for `remote` without `endpoint`.

- **Groups in the grid:** a group received no column class and took 1/12 of the width of its
  containing grid, so top-level groups rendered narrow and overlapping. They now always take the full row
  (`df-col-12`), in addition to their `cssClass`.
- **`df-radio`:** options with `disabled: true` were rendered as disabled, but could still be
  clicked and changed the model. Now the input is truly disabled, also when the whole field
  is disabled or enabled through `disabledWhen`.
- **`SchemaValidatorService`:** a schema with a `null` node inside `fields` threw a `TypeError`.
  It now returns the error `Nodo inválido` at the node's path, like every other issue.
- **Length messages:** no more Formly warnings about using the deprecated `minlength` and
  `maxlength` keys in the global messages.

### Internal

- Unit tests for the business validators, the four services, `<dynamic-form>`, the seven field types and
  the two wrappers (398 tests, ~98 % coverage), with Vitest on jsdom and without zone.js.
- Linting with angular-eslint and CI on GitHub Actions (lint, tests with coverage and build).
- `@angular/build` builders across the whole workspace; no webpack or Karma.

### Migrating from 1.x

1. Update the app to Angular 21 (`ng update @angular/core@21 @angular/cli@21`). If the app uses zone.js,
   keep the polyfill and register `provideZoneChangeDetection()`, because Angular 21 is zoneless by default.
2. Install `@ngx-formly/core@10` and, if you use them, `@ngx-formly/material@10` or `@ngx-formly/bootstrap@10`.
3. Look for direct reads of `errors.minlength` or `errors.maxlength` and change them to `errors.minLength` and
   `errors.maxLength`. Per-field messages with the old key (`validation.messages.minlength`) still
   work, although you should migrate them.
4. If you listen to `statusChange`, keep in mind that you will now receive an emission when the form mounts.
5. Run your schemas through `SchemaValidatorService.validate()` before upgrading in production: the
   new rules (conditions with `value`, `map`/`endpoint`/`items`, `layout`) may reject schemas that
   used to be accepted.
6. Review forms with `type: email` fields: they are no longer submitted if the email is invalid.
7. Rename your own props that start with `on` (e.g. `onlyDigits`), because they are now dropped.
8. If a schema or group does not set `columns`, it now puts one field per row. Add `columns` wherever you want a different layout.
9. Review the `maxLength` of fields with Spanish text: ñ and accented letters count as 2. If your backend counts
   characters, set `maxLengthMode: 'chars'`.

## 1.0.0

Initial release: form rendering from the JSON contract (`openspec.yaml`) with Formly,
business validators by alias, declarative conditional logic, cascading options (`static`,
`dependent`, `remote`) and plain, Material and Bootstrap themes.

[2.0.0]: https://github.com/privadosIA/forms-lib/releases/tag/v2.0.0
