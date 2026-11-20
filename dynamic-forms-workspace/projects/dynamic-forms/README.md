# @core/dynamic-forms

Render Angular reactive forms from JSON. The backend (or Appian) sends a schema; the library validates it, sanitizes it and renders it with [Formly](https://formly.dev) — but you never touch Formly yourself. You only deal with the JSON contract ([`openspec.yaml`](../../openspec.yaml)), `provideDynamicForms()` and the `<dynamic-form>` component.

- 12 field types, including amounts with the value in words and textareas with a character counter
- Declarative conditional logic (`showWhen`, `hideWhen`, `requiredWhen`, `disabledWhen`) without `eval`
- Built-in, business (DNI, NIE, CIF, IBAN…) and custom validators — sync or async — referenced by alias
- Static, dependent and remote options with cascading resets
- 12-column grid layout, groups, repeatable lists and read-only data tables (rows from your services, paginated in the client or in the server)
- Plain, Material and Bootstrap themes, themable through CSS custom properties
- Schema validation and sanitization before anything is rendered

User-facing messages (validation errors, amounts in words, default labels) are in Spanish; all of them can be overridden.

## Requirements

| Package | Version |
|---|---|
| `@angular/core`, `@angular/common`, `@angular/forms` | `^21.0.0 \|\| ^22.0.0` |
| `@ngx-formly/core` | `^10.0.0 \|\| ^11.0.0` (10 for Angular 21, 11 for Angular 22) |
| `rxjs` | `^7.0.0` |
| `@ngx-formly/material` / `@ngx-formly/bootstrap` | same major as `@ngx-formly/core`, only for those themes |

## Quick start

```bash
npm install @core/dynamic-forms @ngx-formly/core
```

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideDynamicForms } from '@core/dynamic-forms';

export const appConfig: ApplicationConfig = {
  providers: [provideDynamicForms()],
};
```

```scss
// styles.scss
@use '@core/dynamic-forms/styles/plain';
```

```ts
// contact.component.ts
import { Component, signal } from '@angular/core';
import { DfFormSchema, DfSubmitEvent, DynamicFormComponent } from '@core/dynamic-forms';

@Component({
  selector: 'app-contact',
  imports: [DynamicFormComponent],
  template: `<dynamic-form [schema]="schema" [(model)]="model" (formSubmit)="save($event)" />`,
})
export class ContactComponent {
  readonly model = signal<Record<string, unknown>>({});
  readonly schema: DfFormSchema = {
    version: '1.0',
    id: 'contact',
    title: 'Contact',
    layout: { columns: 2 },
    fields: [
      { key: 'name', type: 'text', label: 'Name', validation: { required: true, maxLength: 80 } },
      { key: 'email', type: 'email', label: 'Email', validation: { required: true } },
      {
        key: 'reason', type: 'select', label: 'Reason',
        options: [{ value: 'info', label: 'Information' }, { value: 'claim', label: 'Claim' }],
      },
      {
        key: 'details', type: 'textarea', label: 'Details', layout: { col: 12 },
        validation: { maxLength: 500 },
        logic: { showWhen: { field: 'reason', operator: 'eq', value: 'claim' } },
      },
    ],
  };

  save(event: DfSubmitEvent): void {
    console.log(event.model); // only fires when the form is valid
  }
}
```

In a real app the schema usually comes from an HTTP call; the component just binds whatever arrives.

## Configuration

`provideDynamicForms(config?)` accepts:

| Option | Default | Purpose |
|---|---|---|
| `theme` | `PLAIN_THEME` | Which component renders each type: `PLAIN_THEME`, `materialTheme(providers)`, `bootstrapTheme(providers)` or your own `DfTheme`. |
| `validators` | `[]` | Your own validators, referenced by alias from the schema. |
| `messages` | built-in | Global override of validation messages, by error name. |
| `optionsProvider` | — | Class implementing `DfOptionsProvider`; resolves `options.source = 'remote'`. |
| `tableProvider` | — | Class implementing `DfTableProvider`; resolves `table.source` (see [Data tables](#data-tables)). |
| `types` / `wrappers` | `[]` | Extra Formly types and wrappers. A registered type can be used in a schema's `type`. A type with `wrappers: []` renders without the theme's field wrapper (see [Custom types](#custom-types-without-the-field-wrapper)). |
| `strictSchema` | `true` | Throw `DynamicFormsSchemaError` when the schema breaks the contract. With `false` it logs a warning and renders what it can. |
| `defaultResetOnHide` | `true` | Default for `logic.resetOnHide`, for the whole app. A schema can override it with `layout.resetOnHide`. |
| `maxLengthMode` | `'weighted'` | How `maxLength` counts: `'weighted'` counts ñ, á, ü, €… as 2; `'chars'` counts 1. |
| `currency` | `{ code: 'EUR', numberFormat: 'es' }` | Defaults for `currency` fields (see [Amounts](#amounts)). |
| `tableTexts` | Spanish | Replaces the fixed texts of the data tables: see [Translating the table texts](#translating-the-table-texts). |

## The schema

```jsonc
{
  "version": "1.0",           // contract version; anything else is rejected
  "id": "claim",              // the <form> gets id="df-claim"
  "title": "Claim",           // optional heading and description
  "description": "…",
  "layout": { "columns": 2, "gap": "1rem" },   // also "resetOnHide": false (see Conditional logic)
  "fields": [ /* fields, groups, lists, tables and slots */ ],
  "meta": { }                 // opaque data for you (process ids…); the library ignores it
}
```

### Fields

| Property | Meaning |
|---|---|
| `key` | Model property; dotted keys (`address.city`) build nested objects. |
| `type` | See [Field types](#field-types). |
| `label`, `placeholder`, `description` | Texts; `description` is the help text below the control. |
| `defaultValue` | Initial value when the model has none. |
| `readonly`, `disabled`, `hidden` | Static flags (for reactive ones use `logic`). |
| `options` | For `select`, `multiselect` and `radio`. See [Options](#options-and-cascades). |
| `validation` | See [Validation](#validation). |
| `logic` | See [Conditional logic](#conditional-logic). |
| `layout` | `{ col, order, cssClass }`. |
| `props` | Extra inputs for the type component (`rows`, `step`, `autocomplete`, `inline`…). |

### Groups

```json
{ "type": "group", "id": "address", "title": "Address", "columns": 2, "fields": [ … ], "logic": { … } }
```

A group renders as a `fieldset` that takes the whole row, with its own grid. Groups can be nested and support `logic` like fields. Groups have no `key`: their fields write to the root model. A group's `cssClass` is set on the grid cell and also on the `fieldset.df-group`, so `.my-group.df-group { border: 0 }` removes the frame without a descendant selector.

### Repeatable lists

```json
{
  "type": "array", "key": "lines", "title": "Invoice lines", "itemLabel": "Line",
  "display": "table", "minItems": 1, "maxItems": 10, "addLabel": "Add line",
  "fields": [
    { "key": "concept", "type": "text", "label": "Concept", "layout": { "col": 6 }, "validation": { "required": true } },
    { "key": "quantity", "type": "number", "label": "Quantity", "layout": { "col": 2 } },
    { "key": "reason", "type": "text", "label": "Reason", "layout": { "col": 4 },
      "logic": { "requiredWhen": { "field": "./quantity", "operator": "gt", "value": 100 } } }
  ]
}
```

The model stores `lines: [{ concept, quantity, reason }, …]`, one object per row. The user adds and removes rows with buttons, and each row is validated like any other field.

| Property | Meaning |
|---|---|
| `key` | Model property that holds the array. |
| `fields` | The fields of each row (and groups, in the `rows` display). |
| `display` | `rows` (default): one card per row, titled `itemLabel` + number, laid out like a group (`columns` fields per line). `table`: a header with the field labels and one line per row; each field is a column and its `layout.col` is its relative width. In a form narrower than 640 px each row becomes a card with the cells stacked and the column label above each field. |
| `minItems`, `maxItems` | Row limits. The form starts with `minItems` empty rows; the remove button stops at the minimum and the add button at the maximum. Out of range, the list is invalid (`minItems` / `maxItems` errors). |
| `title`, `description`, `itemLabel`, `addLabel`, `removeLabel`, `cssClass`, `logic` | Texts, classes and conditional logic for the whole list. |
| `totals` | Summaries shown below the rows: `[{ "label": "Total", "op": "sum", "field": "price" }]`. |

Inside a row, a rule can read another field **of the same row** with a relative path: `./quantity`. The same goes for `options.dependsOn` (a cascade between two fields of a row, which resets the child when the parent changes). A key without `./` is still read from the form's root. The validator rejects `./…` outside a list and when the row has no such field.

**Totals.** `op` is `sum`, `count`, `avg`, `min` or `max`, and `field` is a `number` or `currency` field of the row (`count` doesn't need one: without `field` it counts the rows, with `field` the rows where it is filled). They recalculate on every change and ignore empty or unreadable values: `sum` shows 0 and the others a dash when there is nothing to calculate. A `currency` field's total is shown with its currency and number format (`1.600,50 €`). Totals are **display only**: they are not stored in the model, so the backend recomputes them.

Restrictions: a list cannot contain another list, and in `table` display fields cannot be hidden (`hidden`, `showWhen`, `hideWhen`) and groups are not allowed, because they would misalign the columns. Every theme renders lists with the library's own `df-repeat` component.

### Slots

A `slot` node reserves a place between the schema's fields for a block of your own (a preview, a summary, a panel), without cutting the schema in several forms:

```json
{ "type": "slot", "name": "summary", "logic": { "showWhen": { "field": "type", "operator": "eq", "value": "company" } } }
```

```html
<dynamic-form [schema]="schema" [(model)]="model">
  <ng-template dfSlot="summary" let-model><app-summary [data]="model" /></ng-template>
</dynamic-form>
```

A slot is not a field: it has no `key`, creates no control and writes nothing to the model. It takes the whole row, supports `logic` (`showWhen`/`hideWhen`) and `cssClass`, and can sit at the root or inside a group (not inside a repeatable list). The template gets the form's model (`let-model`, kept up to date as the user types) and the slot `name` (`let-name="name"`); with no template of that name nothing is drawn. Import `DfSlotDirective` in the component that uses it.

### Data tables

A `table` node shows read-only data: it is not a form field, so it has no `key` and writes nothing to the model.

```json
{
  "type": "table", "id": "cases", "title": "Cases",
  "filter": true, "pageSize": 10, "selectable": true,
  "sort": { "key": "date", "direction": "desc" },
  "actions": [{ "name": "view", "label": "View" }],
  "columns": [
    { "key": "number", "label": "Case", "col": 2 },
    { "key": "subject", "label": "Subject", "col": 4 },
    { "key": "date", "label": "Date", "type": "date" },
    { "key": "status", "label": "Status", "type": "map", "map": { "P": "Pending", "A": "Approved" } },
    { "key": "amount", "label": "Amount", "type": "currency" }
  ],
  "source": { "endpoint": "/api/cases", "mode": "server", "dependsOn": ["office"] }
}
```

```html
<dynamic-form [schema]="schema" [(model)]="model"
  (tableAction)="open($event)" (tableSelect)="selected = $event.row" />
```

| Property | Meaning |
|---|---|
| `id` | Identifies the table in the events. |
| `source` | The rows come from a service of your app: [see below](#loading-rows-from-a-service). |
| `rows` / `dataKey` | Without a service: the rows inline in the schema, or the dotted path of an array in the form's model (`"cases"`, `"data.cases"`), which can arrive or be replaced after the form renders. `dataKey` wins over `rows`; neither can be combined with `source`. Replace the array to update the table; mutating it in place is not detected. |
| `columns` | `key` (dotted keys read nested objects), `label`, and optionally `type`, `sortable`, `col` (relative width, 1–12), `map`, `variants`, `href`, `template`, `currency`, `filter`, `frozen` and `html`. |
| `columns[].filter` | A filter under that column's header: a text box (contains, case and accent insensitive) or, for `map` and `boolean` columns, a drop-down. Filters combine with each other and with `filter`. |
| `columns[].frozen` | Keeps the column fixed on the left while the table scrolls horizontally (with `selectable: "multiple"` the checkbox column is fixed too). Only the first columns can be frozen. |
| `columns[].html` | Renders a `text` column's cells as HTML (links, badges) instead of text. The HTML is sanitized by Angular (no scripts, `on*`, `style` or `javascript:` URLs), and filter, sort and CSV use the text without tags. Badges: `<span class="df-badge df-badge--ok">Activo</span>`, with `--ok`, `--warn`, `--error` or `--info`. |
| `pinnableColumns` | A pin button in every column header so the user can freeze or release it. A frozen column moves to the end of the frozen block and goes back to its place when released. It starts from `columns[].frozen`; the choice lasts only while the table is on screen. |
| `resizableColumns` | The right edge of each header can be dragged to resize the column, or moved with ←/→ when focused (10 px, 50 with Shift); a double click restores the schema's widths. Widths become pixels from the first change and the table scrolls horizontally if it does not fit. |
| `reorderableColumns` | The user can drag a header onto another to reorder the columns, or press Alt + ←/→ on a focused header. Frozen columns only move among the frozen ones, normal ones among the normal ones. |
| `persistState`, `stateKey` | Remember the sort, the search, the column filters, the rows per page, the pinned columns, the column order and the widths between visits: `true` / `"session"` use `sessionStorage`, `"local"` uses `localStorage`. The entry is `df-table:<stateKey>` (default: the table `id`), so give two tables with the same `id` different keys. Stale entries are checked against the columns and ignored. The page and the selection are not saved. |
| `filter`, `filterLabel` | A search box over the text the user sees in the columns (case and accent insensitive: `pena` finds `Peña`). |
| `searchKeys` | Extra row keys (dotted, e.g. `"run.id"`) the search box also looks at, so a search can match data that is not a visible column. Client mode only; in `server` mode the service decides what to search. |
| `pageSize`, `pageSizeOptions` | Paging. Without `pageSize` the table shows every row (`source.mode: "server"` requires it). The options default to 5, 10, 25 and 100. |
| `sort` | Initial order: `{ key, direction }`, or a list of them with `multiSort`. Clicking a header cycles ascending, descending and unsorted. |
| `multiSort` | Sort by several columns: Shift + click on a header adds it to the order (or flips its direction, and a third time removes it); a click without Shift sorts by that column alone. The first column rules and the next ones break ties; each header shows its position. |
| `selectable` | `true` / `"single"`: a click selects one row (another click deselects it). `"multiple"`: a checkbox column, and a header checkbox that ticks every filtered row (in `server` mode, the page's rows). Shift+click ticks the range between the last clicked row and this one. Emits `tableSelect`. |
| `selectableWhen` | A [condition](#conditional-logic) on the row (`./field` reads the row, any other path the form model): only the rows that meet it can be selected. The others get a disabled checkbox, ignore clicks, and the header checkbox skips them. |
| `headerSelects` | With `selectable: "multiple"`: `"filtered"` (default) makes the header checkbox tick every filtered row, `"page"` only the visible page. In `server` mode it is always the page. |
| `selectionKey` | With `selectable: "multiple"`: the row property that identifies a row (`"id"`), so that in `server` mode the selection survives a change of page, sort or filter. Without it those changes clear the selection. |
| `exportCsv` | `true` or `{ "filename": "cases" }` adds an "Exportar CSV" button: [see below](#exporting-to-csv). |
| `actions` | A button per row for each action; clicking emits `tableAction`. Each action is `{ name, label, icon?, tooltip?, showWhen?, disabledWhen? }`. With `icon` the button shows only the icon (`label` becomes its accessible name and, without `tooltip`, its title): use `view`, `edit`, `delete`, `download`, `add`, `check` or `close` for a built-in SVG, or any short text such as an emoji. `showWhen` / `disabledWhen` are [conditions](#conditional-logic) evaluated per row: `./field` reads the row, any other path the form model. A disabled or hidden action never emits. |
| `emptyMessage`, `errorMessage`, `title`, `description`, `cssClass`, `logic` | Texts, a class, and conditional logic (`showWhen`/`hideWhen`) for the whole table. |

Column types: `text` (default), `number` and `currency` (right-aligned, with the app's number format; `currency` also its currency, or the column's `currency`), `date` (`dd/MM/yyyy`), `datetime` (adds `HH:mm` when the value has a time), `boolean` (`Sí` / `No`) and `map` (looks the value up in `map`, and shows it as it is when it isn't there), `badge` and `link` (below). 
**Badges and links without HTML.** `type: "badge"` draws the value as a coloured pill: `map` gives the text (the value itself without it) and `variants` the colour (`ok`, `warn`, `error` or `info`; a value without an entry gets the neutral pill). It filters with a drop-down like `map`. `type: "link"` draws the cell text as a link to `href`, where `{key}` is replaced by the row's property (dotted keys allowed, URL-encoded); `href` must start with `/`, `#`, `http://` or `https://`, and if a value is missing the cell shows its text without a link.

```json
{ "key": "state", "label": "State", "type": "badge", "map": { "OK": "Done", "KO": "Failed" }, "variants": { "OK": "ok", "KO": "error" } },
{ "key": "id", "label": "Run", "type": "link", "href": "/runs/{id}" }
```

**Your own cells and empty state.** For anything the column types don't cover (an icon, a component, a menu), give the column a `template` name and provide the template inside `<dynamic-form>` with `dfCell`. Filtering, sorting and the CSV still use the column's value, and if no template has that name the cell shows its text. For an empty table, `dfEmpty` replaces `emptyMessage` (`dfEmpty="runs"` is for the table with that `id`; without a value it applies to every table that has no template of its own). A search or filter with no results keeps showing the library's text. Import `DfCellDirective` and `DfEmptyDirective` in the component that uses them.

```html
<dynamic-form [schema]="schema">
  <ng-template dfCell="state" let-row let-value="value">
    <app-state-chip [state]="value" [runId]="row.id" />
  </ng-template>
  <ng-template dfEmpty="runs" let-table>
    <p>No runs yet.</p> <button (click)="startRun()">Start one</button>
  </ng-template>
</dynamic-form>
```

A click on a link emits `tableNavigate` with `{ tableId, column, href, row, originalEvent }`. To stay inside your single-page app, call `originalEvent.preventDefault()` and navigate yourself; if you don't, the browser follows the link and the page reloads. Ctrl/Cmd/Shift clicks and middle clicks emit nothing (the browser opens a tab). Clicking a link does not select the row.

```html
<dynamic-form [schema]="schema" (tableNavigate)="$event.originalEvent.preventDefault(); router.navigateByUrl($event.href)" />
```

Dates are read from ISO 8601 (`2024-03-15`, `2024-03-15T10:30:00`) or `dd/MM/yyyy`, and sorted by their real value, not by text. A value that doesn't fit its type is shown as it is, and empty cells always sort last.

#### Loading rows from a service

With `source`, the rows are never in the schema: your `DfTableProvider` loads them, like `DfOptionsProvider` does for remote options.

```ts
@Injectable()
export class CasesTableProvider implements DfTableProvider {
  private readonly http = inject(HttpClient);

  load(endpoint: string, r: DfTableRequest): Observable<DfTablePage | Record<string, unknown>[]> {
    let params = new HttpParams({ fromObject: r.params as Record<string, string> });
    if (r.pageSize) params = params.set('page', r.page).set('size', r.pageSize);
    if (r.sort) params = params.set('sort', r.sort.key).set('dir', r.sort.direction);
    if (r.filter) params = params.set('q', r.filter);
    return this.http.get<DfTablePage>(endpoint, { params });
  }
}

provideDynamicForms({ tableProvider: CasesTableProvider });
```

`source.mode` decides who paginates:

| `mode` | The service returns | Filter, sort and paging |
|---|---|---|
| `client` (default) | **Everything**, as an array or as `{ rows, total }`. One request. | The table does them locally; changing page, sort or search doesn't call again. |
| `server` | **One page** as `{ rows, total }`, where `total` counts all the rows that match the filter. One request per page, sort, page size or search. | The service does them, and the table shows the rows exactly as they arrive. Requires `pageSize`. |

`request` is `{ page, pageSize, sort, sorts, filter, columnFilters, params }`. In `client` mode `page` is 0, `pageSize` and `sort` are `null`, `sorts` is `[]`, `filter` is empty, `columnFilters` is `{}` and only `params` matter. In `server` mode `columnFilters` maps the key of each filtered column to what the user typed, or to the value chosen in the drop-down of a `map` column (its `map` key) or `boolean` column (`"true"` / `"false"`); empty filters are left out. In `server` mode `page` starts at 0 and `sort` is `{ key, direction }` (the `sort` of the schema at first) and `sorts` is the whole order, from the main column to the last tiebreak (more than one only with `multiSort`; `sort` is its first element), and the search is sent 300 ms after the last keystroke. A response in `server` mode that is a plain array counts its length as the total.

`source.dependsOn` lists form fields (root keys, or `./key` inside a repeatable list) whose values are sent as `request.params`, by name. Changing any of them reloads the table from the first page; while one is empty, nothing is requested and the table shows its `emptyMessage`. While a request is pending the table shows "Cargando…"; if it fails, it shows `errorMessage` with a retry button; and if a newer request replaces an older one, the old response is discarded. Reloading clears the selected row (`tableSelect` with `row: null`). Without a registered `tableProvider` the table logs a warning and shows the error.

**Search form with a "Search" button.** `dependsOn` reloads the table on every change of the field, with no button. To search only when the user presses a button, put the criteria and the table in two `<dynamic-form>`s and copy the criteria into the table's model on submit:

```html
<dynamic-form [schema]="criteria" submitLabel="Buscar" (formSubmit)="applied.set({ ...$event.model })" />
<dynamic-form [schema]="results" [model]="applied()" [showDefaultActions]="false" />
```

```json
"source": { "endpoint": "/api/cases", "mode": "server", "dependsOn": ["q", "status"],
            "externalParams": true, "requireParams": false }
```

`externalParams: true` makes `dependsOn` name keys of the model the app passes in, instead of fields of the table's own schema (the validator only checks they are valid keys). `requireParams: false` loads the table even if some criterion is empty (the empty value is sent as is in `params`), so optional criteria work; start `applied` with the default values if you want results before the first search. `formSubmit` fires only when the criteria are valid.

#### Exporting to CSV

`exportCsv` adds an "Exportar CSV" button above the table. The file has what the user sees: the label of each column as header and the formatted text in every cell (`1.500,75 €`, `15/03/2024`, `Sí`), separated by `;` (Excel with Spanish settings opens it in columns), in UTF-8 with a BOM so the accents survive, with CRLF line ends. A text that Excel would evaluate as a formula (it starts with `=`, `+`, `@`, or `-` followed by a non-number) gets a `'` in front. The file is named after `filename` (or the table `id`).

It exports every row that matches the search and the column filters, in the current order. If rows are ticked (`selectable: "multiple"`), it exports only those, and the button reads "Exportar selección (3)". In `server` mode the table only has one page, so the export asks your `DfTableProvider` for the whole search: the same request with `page: 0` and `pageSize` equal to the total. Make sure the service accepts that page size.

#### Translating the table texts

The fixed texts of the tables are Spanish. `provideDynamicForms({ tableTexts })` replaces any of them for the whole app; what you leave out stays in Spanish.

For English there is a ready-made set: `provideDynamicForms({ tableTexts: EN_TABLE_TEXTS, messages: EN_VALIDATION_MESSAGES })` (the second one translates the built-in validation messages). Spread them to override a few: `tableTexts: { ...EN_TABLE_TEXTS, search: 'Find' }`.

```ts
provideDynamicForms({
  tableTexts: {
    search: 'Search',
    actions: 'Actions',
    rowsPerPage: 'Rows per page',
    range: '{from}–{to} of {total}',
    noResults: 'No results for «{text}»',
    exportCsv: 'Export CSV',
    exportSelection: 'Export selection ({n})',
  },
});
```

The keys are `search`, `actions`, `loading`, `retry`, `empty`, `error`, `noResults`, `noResultsFiltered`, `rowsPerPage`, `previousPage`, `nextPage`, `range`, `all`, `filterBy`, `selectAll`, `selectRow`, `exportCsv`, `exportSelection`, `exporting`, `exportFailed`, `pinColumn`, `unpinColumn`, `reorderHint` and `resizeColumn` (the `DfTableTexts` type). Some take placeholders: `{from}`, `{to}` and `{total}` in `range`, `{text}` in `noResults`, `{label}` in `filterBy`, `pinColumn` and `unpinColumn`, `{n}` in `exportSelection`. In the schema, `filterLabel`, `emptyMessage` and `errorMessage` still win over `search`, `empty` and `error` for that one table. Boolean cells (`Sí`/`No`) are not part of these texts and stay in Spanish.

#### Events

`tableAction` emits `{ tableId, action, row }`, `tableNavigate` emits `{ tableId, column, href, row, originalEvent }` (see above) and `tableSelect` emits `{ tableId, row, rows }`. `rows` is always the whole selection. With single selection `row` is the chosen row (`null` when it is cleared); with `selectable: "multiple"` `row` is `null` and you read `rows`. `row` is the object from your data, so you can identify it with your own id. `changed` tells what this event changed, in any mode: `{ rows, selected }`, where `selected: true` lists the rows just ticked (one on a click, several with Shift+click or the header checkbox) and `selected: false` the rows just unticked (also the ones lost when the table reloads). With single selection, `changed.rows` is the chosen row (or the one just released). Use it instead of diffing `rows` against the previous event. A table cannot go inside a repeatable list with `display: "table"`. Every theme renders it with the library's own `df-table` component.

### Layout

The grid always has 12 columns. `columns` (on the form or a group) is **fields per row**: each field spans `12 / columns` unless it sets `layout.col` (1–12). The default is one field per row. When the form itself is narrower than 640 px (a container query on the `<dynamic-form>` width, not on the window, so a form inside a narrow panel stacks too) every field takes the full row. `layout.gap` sets the space between columns and only accepts simple CSS lengths (`1rem`, `12px`…).

### Where the schema comes from

`<dynamic-form>` only needs a schema object, so it does not matter where it comes from: a static JSON file, an object in your code, or a service (your backend, Appian…). Whatever the source, the schema goes through the same validation and sanitization (see [Schema validation and security](#schema-validation-and-security)).

```ts
@Component({
  imports: [DynamicFormComponent],
  template: `
    @if (schema.value(); as s) {
      <dynamic-form [schema]="s" [(model)]="model" />
    } @else if (schema.error()) {
      <p>The form could not be loaded.</p>
    } @else {
      <p>Loading…</p>
    }
  `,
})
export class ClaimPage {
  private readonly http = inject(HttpClient);
  readonly model = signal({});
  readonly schema = rxResource({
    stream: () => this.http.get<DfFormSchema>('/api/forms/claim'),
  });
}
```

The JSON cannot carry code. Validator aliases and custom field types it mentions must be registered in the app with `provideDynamicForms({ validators, types })`, and `remote` options are resolved by your `DfOptionsProvider` and `table.source` by your `DfTableProvider`.

## Field types

| `type` | Renders | Notes |
|---|---|---|
| `text`, `email`, `password`, `number`, `date` | `<input>` | `email` validates the format automatically. |
| `textarea` | `<textarea>` | With `validation.maxLength`, shows an `N/max` counter below the box and blocks typing at the limit. `props.rows` (default 3). |
| `select`, `multiselect` | `<select>` | `multiselect` stores an array. Shows the `placeholder` (or "— Selecciona —") as the empty option. |
| `radio` | radio group | `props.inline` lays the options out in a row. |
| `checkbox` | checkbox | Stores `true`/`false`. |
| `hidden` | nothing visible | Keeps a value in the model (process ids, tokens…). |
| `currency` | amount input | See [Amounts](#amounts). |

Any type registered with `provideDynamicForms({ types: [{ name, component }] })` can also be used.

## Validation

```json
"validation": {
  "required": true,
  "minLength": 2, "maxLength": 60,
  "min": 0, "max": 5000,
  "pattern": "^[A-Z]",
  "validators": [{ "name": "dni" }, { "name": "matchesField", "args": { "field": "password" }, "message": "Passwords do not match" }],
  "asyncValidators": [{ "name": "nifAvailable" }],
  "messages": { "required": "Tell us your {{label}}" }
}
```

**Built-in messages** (Spanish by default): `required`, `email`, `pattern`, `min`, `max`, `minLength`, `maxLength`, `currencyFormat`, `currencyDecimals`. Override them globally with `provideDynamicForms({ messages })` or per field with `validation.messages`. Field messages may use `{{placeholders}}` resolved from the field props (`{{label}}`, `{{minLength}}`…) and from the `args` of the validator with the same name.

**Business validators included**, by alias: `dni`, `nie`, `dniNie` (Spanish national/foreigner ID), `cif` (company tax id), `iban`, `phoneES`, `postalCodeES`, `matchesField` (`args: { field }`). An empty value always passes them; `required` handles emptiness.

**Your own validators** — return `true` when the value is valid:

```ts
import { DfValidatorDefinition } from '@core/dynamic-forms';
import { map, of } from 'rxjs';

const validators: DfValidatorDefinition[] = [
  {
    name: 'adult',
    message: 'You must be at least {{age}}',
    validate: (control, args) => !control.value || yearsSince(control.value) >= Number(args?.['age'] ?? 18),
  },
  {
    name: 'nifAvailable',
    async: true, // goes in validation.asyncValidators
    message: 'This document is already registered',
    validate: (control) => (control.value ? api.isFree(control.value) : of(true)),
  },
];

provideDynamicForms({ validators });
```

**Text length.** By default `maxLength` counts every non-ASCII character (ñ, á, ü, €…) as 2, because many backends measure the limit in bytes: `Año` takes 4. The same rule applies to validation, to blocking input (text inputs and textareas) and to the textarea counter. Use `maxLengthMode: 'chars'` in the config, or `props.maxLengthMode` on a field, to count characters instead. `minLength` always counts characters.

## Conditional logic

```json
"logic": {
  "showWhen": { "field": "type", "operator": "eq", "value": "company" },
  "requiredWhen": { "any": [
    { "field": "type", "operator": "eq", "value": "company" },
    { "not": { "field": "amount", "operator": "lt", "value": 1000 } }
  ] },
  "disabledWhen": { "field": "locked", "operator": "truthy" },
  "resetOnHide": true
}
```

- `showWhen` / `hideWhen` — visibility; `hideWhen` wins when both apply. `hidden: true` always hides.
- `requiredWhen` / `disabledWhen` — combined with the static `required` / `disabled`.
- `resetOnHide` (default `true`) — when hidden, the control leaves the form and its value is removed from the model. The default can be changed for the whole app (`defaultResetOnHide`) or for one schema (`layout.resetOnHide`, handy for an editor that must keep what the current mode doesn't use); a node's own `logic.resetOnHide` wins over both.
- Rules combine with `all`, `any` and `not`, and can be nested. `field` is a dotted key resolved against the root model; inside a [repeatable list](#repeatable-lists), `./key` reads from the current row.
- **External context.** A `field` that starts with `ctx.` reads from the object you pass in `<dynamic-form [context]>`, so a rule can depend on something that is not a form field (a mode, a role, a flag) without a hidden field per flag. When the object changes, the conditions are evaluated again. It also works in the row rules of tables (`actions[].showWhen`, `selectableWhen`…). The validator accepts any name after `ctx.`, since it can't know what you will pass, and `ctx` is reserved: a field can't have that key.

```json
{ "key": "notes", "type": "text", "logic": { "showWhen": { "field": "ctx.mode", "operator": "eq", "value": "edit" } } }
```
```html
<dynamic-form [schema]="schema" [context]="{ mode: mode() }" />
```


| Operator | True when the field value… |
|---|---|
| `eq`, `neq` | equals / differs from `value` (empty values are considered equal) |
| `in`, `nin` | is / is not in the `value` array |
| `gt`, `gte`, `lt`, `lte` | compares numerically with `value` |
| `matches` | matches the regular expression in `value` |
| `contains` | (string or array) contains `value` |
| `empty`, `notEmpty`, `truthy`, `falsy` | — (no `value` needed) |

## Options and cascades

```jsonc
"options": [{ "value": "a", "label": "A" }]                       // static (shorthand)
"options": { "source": "static", "items": [ … ] }
"options": { "source": "dependent", "dependsOn": "province",      // resolved in the client
             "map": { "28": [{ "value": "madrid", "label": "Madrid" }] } }
"options": { "source": "remote", "endpoint": "/api/streets",      // resolved by your provider
             "dependsOn": ["city"] }
```

When a parent changes, the child is cleared (`resetOnChange`, default `true`). Remote options are loaded through your `DfOptionsProvider`, only once every parent has a value, and cached per endpoint and parameters:

```ts
@Injectable()
export class MyOptionsProvider implements DfOptionsProvider {
  private readonly http = inject(HttpClient);
  load(endpoint: string, params: Record<string, unknown>): Observable<DfOption[]> {
    return this.http.get<DfOption[]>(endpoint, { params: params as Record<string, string> });
  }
}

provideDynamicForms({ optionsProvider: MyOptionsProvider });
```

## Amounts

`type: "currency"` handles an amount in any currency, in Spanish (`1.500,75`) or English (`1,500.75`) format, with up to 2 decimals. The model stores a `number`. While editing the field shows the plain number; on blur it shows it formatted (`1.500,75 €`, `£1,500.75`), and below it the amount in words (`MIL QUINIENTOS EUROS CON SETENTA Y CINCO CÉNTIMOS`, `ONE THOUSAND FIVE HUNDRED POUNDS AND SEVENTY-FIVE PENCE`). Badly formatted text (`12.12`, `15 00`, `1500.75` in Spanish format) is flagged with `currencyFormat`; more than two decimals with `currencyDecimals`. `min`, `max` and `required` work on the number.

```ts
provideDynamicForms({ currency: { code: 'GBP', numberFormat: 'en' } }); // app-wide defaults
```

```json
{ "key": "amount", "type": "currency", "props": { "currency": "GBP", "numberFormat": "en" } }
```

| Prop (config key) | Values | Default |
|---|---|---|
| `currency` (`code`) | ISO 4217 code: `EUR`, `GBP`, `USD`… | `EUR` |
| `numberFormat` | `es` (1.500,75) · `en` (1,500.75) | `es` |
| `wordsLanguage` | `es` · `en` | same as `numberFormat` |
| `amountInWords`, `wordsUppercase` | `true` · `false` | `true` |
| `currencyWords` | `{ singular, plural, centSingular, centPlural, feminine?, centFeminine? }` | included for EUR, GBP and USD |

Spanish words respect grammatical gender (“una libra”, “doscientas libras”); English words use British style (“two hundred and fifty”). Other currencies are formatted the same way and need `currencyWords` to be written in words. Formatting and words exist in the plain theme only; Material and Bootstrap render a text input with the same validation.

## The `<dynamic-form>` component

| Input | Default | |
|---|---|---|
| `schema` | — (required) | The JSON schema. Changing it re-renders the form. |
| `[(model)]` | `{}` | Two-way bound form data. |
| `submitLabel` | `'Enviar'` | Text of the default submit button. |
| `showDefaultActions` | `true` | Show the default submit button. |
| `validateOnInit` | `false` | Show errors without waiting for the first submit. |
| `context` | `{}` | Data for conditions: a rule on `ctx.mode` reads `context.mode` (see [Conditional logic](#conditional-logic)). Pass a new object to change it. |
| `showErrors` | `'touched'` | `'always'` shows errors from the moment a field exists, including fields that appear later (conditional sections, new rows); `'touched'` waits for the user to touch the field or submit. |

| Output | Emits |
|---|---|
| `formSubmit` | `{ model, form, schema }` — only when the form is valid. |
| `formInvalidSubmit` | Same payload, when a submit is attempted on an invalid form. |
| `valueChange` | The model, on every change. |
| `statusChange` | `'VALID' \| 'INVALID' \| 'PENDING' \| 'DISABLED'`, including the initial status. |
| `formReady` | The internal `FormGroup`, once built. |

Methods (via a template reference or `viewChild`): `submit()`, `reset(model?)` (back to the initial model or to the given one), `markAllAsTouched()`, `selectAll(tableId?)` / `clearSelection(tableId?)` (tick every row the header checkbox would tick, or empty a table's selection, for buttons outside the table; without `tableId` they act on every table), `revalidate()` (re-runs the validators of every control: call it when a validator reads state outside the form, such as a signal or a service), plus the `form` (`FormGroup`) and `valid` properties.

Content projection: `[dfHeader]` above the fields and `[dfActions]` next to the submit button. `<ng-template dfSlot>` fills the schema's [slots](#slots), and tables take `<ng-template dfCell>` and `<ng-template dfEmpty>` (see [Data tables](#data-tables)).

```html
<dynamic-form #form [schema]="schema" [(model)]="model" submitLabel="Save" (formSubmit)="save($event)">
  <button dfActions type="button" (click)="form.reset()">Clear</button>
</dynamic-form>
```

### Custom types without the field wrapper

Every field gets the theme's field wrapper (`form-field` in Material and Bootstrap, `df-field` in the plain theme). That is wrong for a type that is a block and not a control (a preview, a picker, a panel): Material's `mat-form-field` throws `must contain a MatFormFieldControl`. Declare the wrappers on the type and the theme's are not applied:

```ts
provideDynamicForms({
  theme: materialTheme([...]),
  types: [{ name: 'preview', component: PreviewComponent, wrappers: [] }],
});
```

Any list works (`wrappers: ['my-frame']`). A theme can do the same for a contract type with `typeWrappers: { checkbox: [] }`; the type's own `wrappers` win over it, and it over `fieldWrappers`. Note that without the wrapper there is no label, hint or error text around the control unless your component renders them.

### Good to know

- **The model is edited in place.** Formly writes the user's edits into the object you pass as `model`. To compare with the original afterwards, pass a copy (`structuredClone(original)`).
- **Replacing `model` does not rebuild the fields**, so focus and caret survive; it is safe to push a new object while the user types.
- **Replacing `schema` does rebuild the form.** Don't derive it from state that changes while typing: if you use a `computed`, make it compare by value (`equal` option) so it keeps the same reference when the content is unchanged.
- **Values of empty controls differ.** Number fields emit `null` when empty; text fields emit `''` or `undefined`. Normalise both if you compare or send them.
- **`props.min` / `props.max` add validators** with the built-in `min`/`max` messages. If you only want the HTML attribute (and your own validation), use `props.attributes: { min: 0 }` instead.
- **Hidden fields leave the model** (`defaultResetOnHide: true`). Set it to `false` in `provideDynamicForms` if an editor must keep what the current mode doesn't use.
- **Multiple selection of a table** emits `tableSelect` with `row: null`; the selected rows are in `rows`, and `changed` says which ones this event ticked or unticked.
- **Totals and derived values** (a duration, a summary of options) are not computed for you in tables: put them in the rows.
- **Remote options are cached** per endpoint and params (`shareReplay(1)`). An options source that must follow other state has to be a long-lived stream that keeps emitting.
- **Register at the root.** `ValidatorRegistryService` and the adapter are `providedIn: 'root'`, so `provideDynamicForms` in a route's `providers` does not reach them. Provide the config (validators, `optionsProvider`) in the application config; `ValidatorRegistryService.register()` also works at run time, and so does `FormSchemaAdapterService.registerOptionsProvider(provider)` for the `remote` options source (it clears the options cache).

## Themes and styling

| Theme | Provider | Styles | Extra dependencies |
|---|---|---|---|
| plain (default) | `PLAIN_THEME` | `@use '@core/dynamic-forms/styles/plain'` | none |
| material | `materialTheme([importProvidersFrom(FormlyMaterialModule, MatNativeDateModule)])` | `@use '@core/dynamic-forms/styles/material'` + a Material theme | `@ngx-formly/material` (same major as core), `@angular/material` ≥ 21 |
| bootstrap | `bootstrapTheme([importProvidersFrom(FormlyBootstrapModule)])` | `@use '@core/dynamic-forms/styles/bootstrap'` + bootstrap.css | `@ngx-formly/bootstrap` (same major as core), `bootstrap` 5 |
| custom | any `DfTheme { name, typeMap, fieldWrappers?, typeWrappers?, groupWrapper?, formlyConfig?, providers?, hostClass?, typeProps? }` | your own | — |

A theme only decides which component renders each type; the JSON is the same with any theme. Repeatable lists and data tables are the exception: every theme renders them with the library's own `df-repeat` and `df-table` components, styled with the same custom properties. The plain theme is styled through CSS custom properties, which you can override on `.df-form`:

`--df-color-primary`, `--df-color-text`, `--df-color-muted`, `--df-color-border`, `--df-color-surface`, `--df-color-danger`, `--df-color-focus`, `--df-radius`, `--df-field-gap`, `--df-grid-gap`, `--df-label-size`, `--df-control-padding`, `--df-font`.

```scss
.df-form { --df-color-primary: #0969da; --df-radius: 4px; }
```

## Schema validation and security

Every schema goes through `SchemaValidatorService` before rendering: types, keys, references in conditions and `dependsOn` (including `./field` paths inside lists), registered validator aliases, options, layout, repeatable lists and their totals, data tables (columns, sort, actions, rows), and `currency` props. With `strictSchema` (the default) an invalid schema throws `DynamicFormsSchemaError`, whose `issues` list `{ path, message }`. You can also validate on your own — for instance in a schema editor:

```ts
const { valid, errors } = inject(SchemaValidatorService).validate(schema);
// errors: [{ path: 'fields[1].logic.showWhen.field', message: 'Campo desconocido: tpye' }]
```

Then the schema is sanitized: only the keys in the contract survive, control characters are removed from texts, and `props` lose function values, `__proto__`/`constructor`/`prototype` and anything starting with `on`. Conditions are evaluated without `eval`.

## Utilities

Also exported, in case you need them outside a form: `parseAmount`, `formatAmount`, `formatNumber`, `amountToWords`, `integerToWords`, `integerToWordsEn`; `textLength`, `truncateToLength`; `isValidDni`, `isValidNie`, `isValidCif`, `isValidIban`, `isValidPhoneES`, `isValidPostalCodeES`; `getByPath`; the node guards `isDfGroup`, `isDfArray`, `isDfTable` and `isDfField`; and the services `FormSchemaAdapterService`, `ConditionEvaluatorService` and `ValidatorRegistryService`.

## More

- [`openspec.yaml`](../../openspec.yaml) — the formal contract between the backend and the library.
- [`CHANGELOG.md`](./CHANGELOG.md) — changes per version, with migration notes.

## License

[Apache-2.0](./LICENSE) — Copyright (c) 2026 Jesús Suero
