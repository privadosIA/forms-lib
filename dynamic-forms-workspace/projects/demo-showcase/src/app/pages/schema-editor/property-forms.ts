import {
  DF_ARRAY_TOTAL_OPS, DfArray, DfArrayTotal, DfArrayTotalOp, DfField, DfFieldType, DfFormSchema, DfGroup, DfOption,
  DfTable, DfTableAction, DfTableColumn, DfTableColumnType, DF_TABLE_COLUMN_TYPES,
} from '@core/dynamic-forms';

/**
 * El panel de propiedades del editor es otro <dynamic-form>: estos esquemas describen las
 * propiedades de un campo, de un grupo y del formulario, y las funciones toXxxModel/applyXxx
 * pasan de un nodo al modelo del panel y de vuelta. Lo que el panel no cubre (lógica condicional,
 * validadores por alias, options dependent/remote…) se conserva y se edita en la pestaña JSON.
 */

type Model = Record<string, unknown>;

const OPTION_TYPES: readonly string[] = ['select', 'multiselect', 'radio'];
const TEXT_TYPES = ['text', 'email', 'password', 'textarea'];
const NUMERIC_TYPES = ['number', 'currency'];

const TYPE_OPTIONS: DfOption[] = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'Email' },
  { value: 'password', label: 'Contraseña' },
  { value: 'number', label: 'Número' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'select', label: 'Desplegable' },
  { value: 'multiselect', label: 'Desplegable múltiple' },
  { value: 'radio', label: 'Opciones (radio)' },
  { value: 'checkbox', label: 'Casilla' },
  { value: 'date', label: 'Fecha' },
  { value: 'currency', label: 'Importe (moneda)' },
  { value: 'hidden', label: 'Oculto' },
];

const typeIn = (types: string[]) => ({ field: 'type', operator: 'in' as const, value: types });

export const FIELD_PROPERTIES: DfFormSchema = {
  version: '1.0',
  id: 'propiedades-campo',
  fields: [
    {
      type: 'group', id: 'basico', title: 'Campo', columns: 2,
      fields: [
        {
          key: 'key', type: 'text', label: 'Key', description: 'Clave en el modelo (admite puntos: a.b)',
          validation: { required: true, pattern: '^[A-Za-z_][A-Za-z0-9_.]*$', messages: { pattern: 'Letras, números, _ y puntos; sin espacios' } },
        },
        { key: 'type', type: 'select', label: 'Tipo', options: TYPE_OPTIONS, validation: { required: true } },
        { key: 'label', type: 'text', label: 'Etiqueta', layout: { col: 12 } },
        { key: 'placeholder', type: 'text', label: 'Placeholder', logic: { hideWhen: typeIn(['checkbox', 'radio', 'hidden']) } },
        { key: 'col', type: 'number', label: 'Columnas (1-12)', validation: { min: 1, max: 12 } },
        { key: 'description', type: 'textarea', label: 'Ayuda bajo el campo', layout: { col: 12 }, props: { rows: 2 } },
      ],
    },
    {
      type: 'group', id: 'validacion', title: 'Validación', columns: 2,
      logic: { hideWhen: { field: 'type', operator: 'eq', value: 'hidden' } },
      fields: [
        { key: 'required', type: 'checkbox', label: 'Obligatorio', layout: { col: 12 } },
        { key: 'minLength', type: 'number', label: 'Mín. caracteres', validation: { min: 0 }, logic: { showWhen: typeIn(TEXT_TYPES) } },
        { key: 'maxLength', type: 'number', label: 'Máx. caracteres', validation: { min: 1 }, logic: { showWhen: typeIn(TEXT_TYPES) } },
        { key: 'min', type: 'number', label: 'Mínimo', logic: { showWhen: typeIn(NUMERIC_TYPES) } },
        { key: 'max', type: 'number', label: 'Máximo', logic: { showWhen: typeIn(NUMERIC_TYPES) } },
        { key: 'pattern', type: 'text', label: 'Patrón (regex)', layout: { col: 12 }, logic: { showWhen: typeIn(['text', 'password']) } },
      ],
    },
    {
      type: 'group', id: 'opciones', title: 'Opciones',
      description: 'Si el origen es dependent o remote, edítalo en la pestaña JSON.',
      logic: { showWhen: typeIn(OPTION_TYPES as string[]) },
      fields: [
        { key: 'optionsEditable', type: 'hidden' },
        {
          key: 'optionsText', type: 'textarea', label: 'Una opción por línea',
          description: 'valor|Etiqueta, o solo la etiqueta si el valor es el mismo.', props: { rows: 4 },
          logic: { showWhen: { field: 'optionsEditable', operator: 'truthy' } },
        },
      ],
    },
    {
      type: 'group', id: 'moneda', title: 'Moneda', columns: 2,
      logic: { showWhen: { field: 'type', operator: 'eq', value: 'currency' } },
      fields: [
        {
          key: 'currency', type: 'select', label: 'Moneda', placeholder: 'La de la app',
          options: [{ value: 'EUR', label: 'Euro (EUR)' }, { value: 'GBP', label: 'Libra (GBP)' }, { value: 'USD', label: 'Dólar (USD)' }, { value: 'CHF', label: 'Franco suizo (CHF)' }],
        },
        {
          key: 'numberFormat', type: 'select', label: 'Formato', placeholder: 'El de la app',
          options: [{ value: 'es', label: 'Español: 1.500,75' }, { value: 'en', label: 'Inglés: 1,500.75' }],
        },
        {
          key: 'wordsLanguage', type: 'select', label: 'Idioma de la letra', placeholder: 'Según el formato',
          options: [{ value: 'es', label: 'Español' }, { value: 'en', label: 'Inglés' }],
        },
        { key: 'amountInWords', type: 'checkbox', label: 'Mostrar el importe en letra' },
      ],
    },
    {
      type: 'group', id: 'estado', title: 'Estado', columns: 3,
      fields: [
        { key: 'hidden', type: 'checkbox', label: 'Oculto' },
        { key: 'disabled', type: 'checkbox', label: 'Deshabilitado' },
        { key: 'readonly', type: 'checkbox', label: 'Solo lectura' },
      ],
    },
  ],
};

export const GROUP_PROPERTIES: DfFormSchema = {
  version: '1.0',
  id: 'propiedades-grupo',
  fields: [
    {
      type: 'group', id: 'grupo', title: 'Grupo', columns: 2,
      fields: [
        { key: 'id', type: 'text', label: 'Id', validation: { required: true } },
        { key: 'columns', type: 'number', label: 'Campos por fila', validation: { min: 1, max: 12 } },
        { key: 'title', type: 'text', label: 'Título', layout: { col: 12 } },
        { key: 'description', type: 'textarea', label: 'Descripción', layout: { col: 12 }, props: { rows: 2 } },
      ],
    },
  ],
};

export const ARRAY_PROPERTIES: DfFormSchema = {
  version: '1.0',
  id: 'propiedades-lista',
  fields: [
    {
      type: 'group', id: 'lista', title: 'Lista repetible', columns: 2,
      fields: [
        {
          key: 'key', type: 'text', label: 'Key', description: 'Clave en el modelo: un array con un objeto por fila',
          validation: { required: true, pattern: '^[A-Za-z_][A-Za-z0-9_.]*$', messages: { pattern: 'Letras, números, _ y puntos; sin espacios' } },
        },
        {
          key: 'display', type: 'select', label: 'Disposición',
          options: [{ value: 'rows', label: 'Filas (tarjetas)' }, { value: 'table', label: 'Tabla' }],
          validation: { required: true },
        },
        { key: 'title', type: 'text', label: 'Título', layout: { col: 12 } },
        { key: 'description', type: 'textarea', label: 'Descripción', layout: { col: 12 }, props: { rows: 2 } },
        { key: 'itemLabel', type: 'text', label: 'Nombre de cada fila', placeholder: 'Elemento', logic: { showWhen: { field: 'display', operator: 'eq', value: 'rows' } } },
        { key: 'columns', type: 'number', label: 'Campos por línea', validation: { min: 1, max: 12 }, logic: { showWhen: { field: 'display', operator: 'eq', value: 'rows' } } },
        { key: 'addLabel', type: 'text', label: 'Botón de añadir', placeholder: 'Añadir' },
        { key: 'removeLabel', type: 'text', label: 'Botón de quitar', placeholder: 'Eliminar' },
        { key: 'minItems', type: 'number', label: 'Mínimo de filas', validation: { min: 0 } },
        { key: 'maxItems', type: 'number', label: 'Máximo de filas', validation: { min: 1 } },
      ],
    },
    {
      type: 'group', id: 'totales', title: 'Totales',
      description: 'Una línea por total: Etiqueta|operación|campo. Operaciones: sum, count, avg, min, max (count no necesita campo).',
      fields: [{ key: 'totalsText', type: 'textarea', label: 'Totales', props: { rows: 3 }, placeholder: 'Importe total|sum|precio' }],
    },
  ],
};

export const TABLE_PROPERTIES: DfFormSchema = {
  version: '1.0',
  id: 'propiedades-tabla',
  fields: [
    {
      type: 'group', id: 'tabla', title: 'Tabla de datos', columns: 2,
      fields: [
        {
          key: 'id', type: 'text', label: 'Id', description: 'Identifica la tabla en los eventos',
          validation: { required: true, pattern: '^[A-Za-z][A-Za-z0-9_-]*$', messages: { pattern: 'Empieza por letra; letras, números, _ y -' } },
        },
        { key: 'sourceEndpoint', type: 'text', label: 'Servicio (endpoint)', placeholder: '/api/expedientes', description: 'Las filas las carga el servicio de la app. Sustituye a las filas y a la propiedad del modelo.' },
        {
          key: 'sourceMode', type: 'select', label: 'Paginación', defaultValue: 'client',
          options: [{ value: 'client', label: 'En el cliente (el servicio devuelve todo)' }, { value: 'server', label: 'En el servidor (una página cada vez)' }],
          logic: { showWhen: { field: 'sourceEndpoint', operator: 'notEmpty' } },
        },
        {
          key: 'dataKey', type: 'text', label: 'Propiedad del modelo', placeholder: 'Vacío: filas del esquema', description: 'Con puntos: datos.clientes',
          logic: { hideWhen: { field: 'sourceEndpoint', operator: 'notEmpty' } },
        },
        { key: 'title', type: 'text', label: 'Título', layout: { col: 12 } },
        { key: 'description', type: 'textarea', label: 'Descripción', layout: { col: 12 }, props: { rows: 2 } },
        { key: 'filter', type: 'checkbox', label: 'Cuadro de búsqueda' },
        { key: 'selectable', type: 'checkbox', label: 'Filas seleccionables' },
        { key: 'persistState', type: 'checkbox', label: 'Recordar orden y filtros (sesión)' },
        { key: 'multiSort', type: 'checkbox', label: 'Orden por varias columnas (Mayús + clic)' },
        { key: 'resizableColumns', type: 'checkbox', label: 'Columnas redimensionables' },
        { key: 'reorderableColumns', type: 'checkbox', label: 'Columnas reordenables arrastrando' },
        { key: 'pinnableColumns', type: 'checkbox', label: 'Columnas fijables desde la cabecera' },
        { key: 'pageSize', type: 'number', label: 'Filas por página', description: 'Vacío: sin paginación', validation: { min: 1 } },
        { key: 'emptyMessage', type: 'text', label: 'Mensaje sin datos', placeholder: 'No hay datos' },
        { key: 'errorMessage', type: 'text', label: 'Mensaje si falla la carga', placeholder: 'No se pudieron cargar los datos', logic: { showWhen: { field: 'sourceEndpoint', operator: 'notEmpty' } } },
      ],
    },
    {
      type: 'group', id: 'columnas', title: 'Columnas y acciones',
      description: 'Una por línea. Columnas: clave|etiqueta|tipo (text, number, currency, date, datetime, boolean, map), y |fija al final para dejarla fija a la izquierda (solo las primeras). Acciones: nombre|etiqueta. Las filas, los mapas y los anchos se editan en el JSON.',
      fields: [
        { key: 'columnsText', type: 'textarea', label: 'Columnas', props: { rows: 4 }, validation: { required: true }, placeholder: 'nombre|Nombre|text|fija' },
        { key: 'actionsText', type: 'textarea', label: 'Acciones', props: { rows: 2 }, placeholder: 'editar|Editar' },
      ],
    },
  ],
};

export const FORM_PROPERTIES: DfFormSchema = {
  version: '1.0',
  id: 'propiedades-formulario',
  fields: [
    {
      type: 'group', id: 'formulario', title: 'Formulario', columns: 2,
      fields: [
        {
          key: 'id', type: 'text', label: 'Id',
          validation: { required: true, pattern: '^[A-Za-z][A-Za-z0-9_-]*$', messages: { pattern: 'Empieza por letra; letras, números, _ y -' } },
        },
        { key: 'columns', type: 'number', label: 'Campos por fila', validation: { min: 1, max: 12 } },
        { key: 'title', type: 'text', label: 'Título', layout: { col: 12 } },
        { key: 'description', type: 'textarea', label: 'Descripción', layout: { col: 12 }, props: { rows: 2 } },
        { key: 'gap', type: 'text', label: 'Separación entre columnas', placeholder: '1rem' },
      ],
    },
  ],
};

// --- Utilidades --------------------------------------------------------------

const blank = (v: unknown) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));

/** Asigna obj[key] = value, o lo borra si el valor está vacío o es false. */
function put(obj: Model, key: string, value: unknown): void {
  if (blank(value) || value === false) delete obj[key];
  else obj[key] = value;
}

/** Borra el objeto anidado si se ha quedado vacío. */
function prune(obj: Model, key: string): void {
  const inner = obj[key];
  if (inner && typeof inner === 'object' && !Array.isArray(inner) && Object.keys(inner).length === 0) delete obj[key];
}

const optionsToText = (options: DfOption[]) =>
  options.map((o) => (String(o.value) === o.label ? o.label : `${o.value}|${o.label}`)).join('\n');

function textToOptions(text: string): DfOption[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [value, ...label] = line.split('|');
    return { value: value.trim(), label: (label.length ? label.join('|') : value).trim() };
  });
}

const DEFAULT_OPTIONS: DfOption[] = [{ value: 'a', label: 'Opción A' }, { value: 'b', label: 'Opción B' }];

// --- Campo ---------------------------------------------------------------------

export function toFieldModel(f: DfField): Model {
  const v = f.validation ?? {};
  const p = f.props ?? {};
  const staticOptions = Array.isArray(f.options) ? f.options : f.options?.source === 'static' ? f.options.items : null;
  return {
    key: f.key, type: f.type, label: f.label ?? '', placeholder: f.placeholder ?? '', description: f.description ?? '',
    col: f.layout?.col ?? null,
    required: v.required === true, minLength: v.minLength ?? null, maxLength: v.maxLength ?? null,
    min: v.min ?? null, max: v.max ?? null, pattern: v.pattern ?? '',
    optionsEditable: f.options == null || !!staticOptions,
    optionsText: staticOptions ? optionsToText(staticOptions) : '',
    currency: p['currency'] ?? null, numberFormat: p['numberFormat'] ?? null, wordsLanguage: p['wordsLanguage'] ?? null,
    amountInWords: p['amountInWords'] !== false,
    hidden: f.hidden === true, disabled: f.disabled === true, readonly: f.readonly === true,
  };
}

export function applyFieldModel(field: DfField, m: Model): DfField {
  const f = structuredClone(field) as DfField & Model;
  const type = (m['type'] as DfFieldType) || field.type;
  f.key = String(m['key'] ?? '');
  f.type = type;
  for (const k of ['label', 'placeholder', 'description']) put(f, k, m[k]);
  for (const k of ['hidden', 'disabled', 'readonly']) put(f, k, m[k]);

  const layout: Model = { ...(f.layout ?? {}) };
  put(layout, 'col', m['col']);
  f.layout = layout;
  prune(f, 'layout');

  const v: Model = { ...(f.validation ?? {}) };
  put(v, 'required', m['required']);
  const textual = TEXT_TYPES.includes(type);
  const numeric = NUMERIC_TYPES.includes(type);
  put(v, 'minLength', textual ? m['minLength'] : null);
  put(v, 'maxLength', textual ? m['maxLength'] : null);
  put(v, 'min', numeric ? m['min'] : null);
  put(v, 'max', numeric ? m['max'] : null);
  put(v, 'pattern', ['text', 'password'].includes(type) ? m['pattern'] : null);
  f.validation = v;
  prune(f, 'validation');

  if (!OPTION_TYPES.includes(type)) {
    delete f.options;
  } else if (m['optionsEditable'] !== false) {
    // Al convertir un campo en select/radio sin opciones se le dan dos de ejemplo para que siga siendo válido.
    const options = textToOptions(String(m['optionsText'] ?? ''));
    f.options = options.length ? options : DEFAULT_OPTIONS;
  }

  const props: Model = { ...(f.props ?? {}) };
  const currency = type === 'currency';
  put(props, 'currency', currency ? m['currency'] : null);
  put(props, 'numberFormat', currency ? m['numberFormat'] : null);
  put(props, 'wordsLanguage', currency ? m['wordsLanguage'] : null);
  if (currency && m['amountInWords'] === false) props['amountInWords'] = false;
  else delete props['amountInWords'];
  f.props = props;
  prune(f, 'props');
  return f;
}

// --- Lista repetible -------------------------------------------------------------

const totalsToText = (totals: DfArrayTotal[]) => totals.map((t) => [t.label, t.op, t.field ?? ''].join('|').replace(/\|$/, '')).join('\n');

function textToTotals(text: string): DfArrayTotal[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [label, op, field] = line.split('|').map((x) => x.trim());
    const total: DfArrayTotal = { label: label ?? '', op: (DF_ARRAY_TOTAL_OPS.includes(op as DfArrayTotalOp) ? op : 'sum') as DfArrayTotalOp };
    if (field) total.field = field;
    return total;
  });
}

export const toArrayModel = (a: DfArray): Model => ({
  key: a.key, display: a.display ?? 'rows', title: a.title ?? '', description: a.description ?? '',
  itemLabel: a.itemLabel ?? '', columns: a.columns ?? null, addLabel: a.addLabel ?? '', removeLabel: a.removeLabel ?? '',
  minItems: a.minItems ?? null, maxItems: a.maxItems ?? null, totalsText: totalsToText(a.totals ?? []),
});

export function applyArrayModel(array: DfArray, m: Model): DfArray {
  const a = structuredClone(array) as DfArray & Model;
  a.key = String(m['key'] ?? '');
  for (const k of ['title', 'description', 'addLabel', 'removeLabel', 'minItems', 'maxItems']) put(a, k, m[k]);
  // "rows" es el valor por defecto: no hace falta escribirlo.
  if (m['display'] === 'table') a.display = 'table';
  else delete a.display;
  const rows = a.display !== 'table';
  put(a, 'itemLabel', rows ? m['itemLabel'] : null);
  put(a, 'columns', rows ? m['columns'] : null);
  const totals = textToTotals(String(m['totalsText'] ?? ''));
  if (totals.length) a.totals = totals;
  else delete a.totals;
  return a;
}

// --- Tabla de datos ----------------------------------------------------------------

const FROZEN_FLAG = 'fija';

const columnsToText = (cols: DfTableColumn[]) => cols.map((c) => [c.key, c.label, c.type ?? 'text', ...(c.frozen ? [FROZEN_FLAG] : [])].join('|')).join('\n');

/** Interpreta las líneas del panel y conserva de cada columna existente lo que el panel no edita (map, col, currency, sortable, filter). */
function textToColumns(text: string, current: DfTableColumn[]): DfTableColumn[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [key, label, type, flag] = line.split('|').map((x) => x.trim());
    const previous = current.find((c) => c.key === key);
    const column: DfTableColumn = { ...previous, key, label: label || key };
    if (type && DF_TABLE_COLUMN_TYPES.includes(type as DfTableColumnType) && type !== 'text') column.type = type as DfTableColumnType;
    else delete column.type;
    if (flag === FROZEN_FLAG) column.frozen = true;
    else delete column.frozen;
    return column;
  });
}

const actionsToText = (actions: DfTableAction[]) => actions.map((a) => `${a.name}|${a.label}`).join('\n');

function textToActions(text: string): DfTableAction[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, ...label] = line.split('|');
    return { name: name.trim(), label: (label.length ? label.join('|') : name).trim() };
  });
}

export const toTableModel = (t: DfTable): Model => ({
  id: t.id, dataKey: t.dataKey ?? '', sourceEndpoint: t.source?.endpoint ?? '', sourceMode: t.source?.mode ?? 'client',
  errorMessage: t.errorMessage ?? '', title: t.title ?? '', description: t.description ?? '',
  filter: t.filter === true, selectable: !!t.selectable, pinnableColumns: t.pinnableColumns === true, persistState: !!t.persistState, reorderableColumns: t.reorderableColumns === true, resizableColumns: t.resizableColumns === true, multiSort: t.multiSort === true, pageSize: t.pageSize ?? null, emptyMessage: t.emptyMessage ?? '',
  columnsText: columnsToText(t.columns ?? []), actionsText: actionsToText(t.actions ?? []),
});

export function applyTableModel(table: DfTable, m: Model): DfTable {
  const t = structuredClone(table) as DfTable & Model;
  t.id = String(m['id'] ?? '');
  for (const k of ['dataKey', 'title', 'description', 'filter', 'pinnableColumns', 'reorderableColumns', 'resizableColumns', 'multiSort', 'pageSize', 'emptyMessage', 'errorMessage']) put(t, k, m[k]);
  // Igual con persistState: el panel solo dice si se recuerda; 'local' se conserva.
  if (!m['persistState']) delete t.persistState;
  else t.persistState = table.persistState || true;
  // El panel solo sabe si hay selección; 'single' y 'multiple' se conservan tal cual.
  if (!m['selectable']) delete t.selectable;
  else if (!table.selectable) t.selectable = true;
  else t.selectable = table.selectable;
  const endpoint = String(m['sourceEndpoint'] ?? '').trim();
  if (endpoint) {
    // Con servicio no puede haber filas ni propiedad del modelo; se conserva lo que el panel no edita (dependsOn).
    const source: Model = { ...(table.source ?? {}), endpoint };
    if (m['sourceMode'] === 'server') source['mode'] = 'server';
    else delete source['mode'];
    t.source = source as unknown as DfTable['source'];
    delete t.rows;
    delete t.dataKey;
  } else {
    delete t.source;
    delete t.errorMessage;
  }
  t.columns = textToColumns(String(m['columnsText'] ?? ''), table.columns ?? []);
  const actions = textToActions(String(m['actionsText'] ?? ''));
  if (actions.length) t.actions = actions;
  else delete t.actions;
  return t;
}

// --- Grupo y formulario -------------------------------------------------------------

export const toGroupModel = (g: DfGroup): Model => ({
  id: g.id, title: g.title ?? '', description: g.description ?? '', columns: g.columns ?? null,
});

export function applyGroupModel(group: DfGroup, m: Model): DfGroup {
  const g = structuredClone(group) as DfGroup & Model;
  g.id = String(m['id'] ?? '');
  for (const k of ['title', 'description', 'columns']) put(g, k, m[k]);
  return g;
}

export const toFormModel = (s: DfFormSchema): Model => ({
  id: s.id, title: s.title ?? '', description: s.description ?? '', columns: s.layout?.columns ?? null, gap: s.layout?.gap ?? '',
});

export function applyFormModel(schema: DfFormSchema, m: Model): DfFormSchema {
  const s = structuredClone(schema) as DfFormSchema & Model;
  s.id = String(m['id'] ?? '');
  for (const k of ['title', 'description']) put(s, k, m[k]);
  const layout: Model = { ...(s.layout ?? {}) };
  put(layout, 'columns', m['columns']);
  put(layout, 'gap', m['gap']);
  s.layout = layout;
  prune(s, 'layout');
  return s;
}
