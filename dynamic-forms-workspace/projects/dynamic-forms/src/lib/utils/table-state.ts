/** Lo que una tabla recuerda entre visitas (`persistState`). La página y la selección no se guardan. */
export interface DfTableState {
  /** Orden elegido; `[]` es «sin orden» (el usuario lo quitó), distinto de no haber elegido nunca. */
  sorts?: { key: string; direction: 'asc' | 'desc' }[];
  filter?: string;
  columnFilters?: Record<string, string>;
  pageSize?: number;
  /** Columnas fijadas por el usuario, en orden (`pinnableColumns`). */
  pinned?: string[];
  /** Orden de todas las columnas elegido arrastrando (`reorderableColumns`). */
  order?: string[];
  /** Anchos en píxeles por columna (más `__check` y `__actions`), tras redimensionar. */
  widths?: Record<string, number>;
}

/** Qué columnas existen ahora mismo: lo guardado que ya no encaje se descarta. */
export interface DfTableStateContext {
  columnKeys: string[];
  filterKeys: string[];
  pinnable: boolean;
  reorderable: boolean;
  resizable: boolean;
}

/** Claves de `widths` para la columna de casillas y la de acciones. */
export const WIDTH_CHECK = '__check';
export const WIDTH_ACTIONS = '__actions';
export const MIN_WIDTH = 48;
export const MAX_WIDTH = 4000;

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Lee el JSON guardado sin fiarse de él: solo se queda lo que tiene la forma esperada y encaja con la tabla. */
export function parseTableState(raw: string | null, ctx: DfTableStateContext): DfTableState {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return {};
  }
  if (!isPlainObject(data)) return {};
  const state: DfTableState = {};
  // `sort` (un solo orden, o null) es el formato de antes de `multiSort`; se sigue leyendo.
  const stored = Array.isArray(data['sorts']) ? data['sorts'] : data['sort'] === null ? [] : isPlainObject(data['sort']) ? [data['sort']] : null;
  if (stored) {
    const seen = new Set<string>();
    state.sorts = [];
    for (const s of stored) {
      if (!isPlainObject(s) || !ctx.columnKeys.includes(String(s['key'])) || seen.has(String(s['key']))) continue;
      seen.add(String(s['key']));
      state.sorts.push({ key: String(s['key']), direction: s['direction'] === 'desc' ? 'desc' : 'asc' });
    }
    // Un orden guardado cuya columna ya no existe vale como «sin orden» solo si el usuario no tenía otro: se descarta entero.
    if (stored.length && !state.sorts.length) delete state.sorts;
  }
  if (typeof data['filter'] === 'string') state.filter = data['filter'];
  if (isPlainObject(data['columnFilters'])) {
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(data['columnFilters'])) {
      if (typeof v === 'string' && ctx.filterKeys.includes(k)) filters[k] = v;
    }
    state.columnFilters = filters;
  }
  if (typeof data['pageSize'] === 'number' && Number.isInteger(data['pageSize']) && data['pageSize'] >= 1) state.pageSize = data['pageSize'];
  if (ctx.pinnable && Array.isArray(data['pinned'])) {
    state.pinned = data['pinned'].filter((k): k is string => typeof k === 'string' && ctx.columnKeys.includes(k));
  }
  if (ctx.reorderable && Array.isArray(data['order'])) {
    const keys = data['order'].filter((k): k is string => typeof k === 'string' && ctx.columnKeys.includes(k));
    // Una columna nueva del esquema que no estaba guardada va al final.
    state.order = [...new Set(keys), ...ctx.columnKeys.filter((k) => !keys.includes(k))];
  }
  if (ctx.resizable && isPlainObject(data['widths'])) {
    const widths: Record<string, number> = {};
    for (const [k, v] of Object.entries(data['widths'])) {
      if ((ctx.columnKeys.includes(k) || k === WIDTH_CHECK || k === WIDTH_ACTIONS) && typeof v === 'number' && v >= MIN_WIDTH && v <= MAX_WIDTH) widths[k] = v;
    }
    // Los anchos valen para todas las columnas a la vez: si falta alguna (el esquema cambió), se descartan.
    if (ctx.columnKeys.every((k) => k in widths)) state.widths = widths;
  }
  return state;
}
