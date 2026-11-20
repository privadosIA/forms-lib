import { DfBadgeVariant, DfTableColumnType } from '../models/schema.model';
import { getByPath } from '../services/condition-evaluator.service';
import { DfNumberFormat, formatAmount, formatNumber } from './currency';

/** Columna ya resuelta por el adaptador: moneda y formato de número incluidos. */
export interface DfResolvedColumn {
  key: string;
  label: string;
  type: DfTableColumnType;
  map?: Record<string, string>;
  variants?: Record<string, DfBadgeVariant>;
  href?: string;
  template?: string;
  sortable: boolean;
  col: number;
  currency: string;
  numberFormat: DfNumberFormat;
  filter: boolean;
  frozen: boolean;
  html: boolean;
}

type Row = Record<string, unknown>;

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha desde `yyyy-MM-dd`, `yyyy-MM-ddTHH:mm[:ss]` o `dd/MM/yyyy [HH:mm]`; la hora es local. */
export function parseDate(value: unknown): { date: Date; hasTime: boolean } | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : { date: value, hasTime: true };
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(text);
  const es = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/.exec(text);
  const m = iso ? [iso[1], iso[2], iso[3], iso[4], iso[5]] : es ? [es[3], es[2], es[1], es[4], es[5]] : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[0]), Number(m[1]), Number(m[2])];
  const date = new Date(y, mo - 1, d, Number(m[3] ?? 0), Number(m[4] ?? 0));
  // Fechas imposibles (31/02) se desplazarían al mes siguiente: se descartan.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return { date, hasTime: m[3] != null };
}

/** El número de una celda: un number, o un texto numérico escrito con punto decimal ("1500.75"). */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

const plainText = (value: unknown): string => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value);
};

/** El texto de un fragmento HTML, sin etiquetas. El documento de `DOMParser` es inerte: no ejecuta ni carga nada. */
export function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, '');
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Lo que se ve en la celda. Un valor que no encaja con el tipo de la columna se muestra tal cual. */
export function formatCell(value: unknown, col: DfResolvedColumn): string {
  if (value == null || value === '') return '';
  switch (col.type) {
    case 'number': {
      const n = toNumber(value);
      return n === null ? plainText(value) : formatNumber(n, col.numberFormat);
    }
    case 'currency': {
      const n = toNumber(value);
      return n === null ? plainText(value) : formatAmount(n, col.currency, col.numberFormat);
    }
    case 'date':
    case 'datetime': {
      const parsed = parseDate(value);
      if (!parsed) return plainText(value);
      const { date, hasTime } = parsed;
      const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
      return col.type === 'datetime' && hasTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
    }
    case 'boolean':
      return value === true || value === 'true' ? 'Sí' : value === false || value === 'false' ? 'No' : plainText(value);
    case 'map':
    case 'badge':
      return col.map?.[plainText(value)] ?? plainText(value);
    default:
      return col.html ? htmlToText(plainText(value)) : plainText(value);
  }
}

export const cellText = (row: Row, col: DfResolvedColumn): string => formatCell(getByPath(row, col.key), col);

/** Minúsculas sin acentos: "Peña" y "pena" se buscan igual. */
export const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterRows(rows: Row[], cols: DfResolvedColumn[], text: string, extraKeys: string[] = []): Row[] {
  const needle = normalize(text.trim());
  if (!needle) return rows;
  const extra = (row: Row, key: string): string => {
    const v = getByPath(row, key);
    return v == null || typeof v === 'object' ? '' : String(v);
  };
  return rows.filter((row) =>
    cols.some((c) => normalize(cellText(row, c)).includes(needle))
    || extraKeys.some((k) => normalize(extra(row, k)).includes(needle)));
}

/** Destino de una celda `link`: `{clave}` se sustituye por la propiedad de la fila; null si falta alguna o no hay `href`. */
export function resolveHref(row: Row, href: string | undefined): string | null {
  if (!href) return null;
  let missing = false;
  const out = href.replace(/\{([\w.]+)\}/g, (_, key: string) => {
    const v = getByPath(row, key);
    if (v == null || v === '' || typeof v === 'object') { missing = true; return ''; }
    return encodeURIComponent(String(v));
  });
  return missing ? null : out;
}

/** Cómo se filtra una columna: escribiendo texto, o eligiendo un valor (`map`, `badge` y `boolean`). */
export const columnFilterKind = (col: DfResolvedColumn): 'text' | 'select' =>
  col.type === 'map' || col.type === 'badge' || col.type === 'boolean' ? 'select' : 'text';

/** Opciones del desplegable de una columna `map` o `boolean`; `value` es lo que se envía como filtro. */
export function columnFilterOptions(col: DfResolvedColumn): { value: string; label: string }[] {
  if (col.type === 'boolean') return [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }];
  if (col.type === 'badge' && !col.map) return Object.keys(col.variants ?? {}).map((value) => ({ value, label: value }));
  return Object.entries(col.map ?? {}).map(([value, label]) => ({ value, label }));
}

/** El valor de una celda `map` o `boolean` tal como se envía en el filtro (`""` si está vacía). */
function filterValue(row: Row, col: DfResolvedColumn): string {
  const value = getByPath(row, col.key);
  if (value == null || value === '') return '';
  if (col.type === 'boolean') return value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : '';
  return plainText(value);
}

/** Filas que cumplen todos los filtros por columna (`key` → texto o valor elegido); ignora los vacíos. */
export function filterByColumns(rows: Row[], cols: DfResolvedColumn[], filters: Partial<Record<string, string>>): Row[] {
  const active = cols.filter((c) => c.filter && (filters[c.key] ?? '').trim() !== '');
  if (!active.length) return rows;
  return rows.filter((row) => active.every((c) => {
    const wanted = (filters[c.key] ?? '').trim();
    return columnFilterKind(c) === 'select'
      ? filterValue(row, c) === wanted
      : normalize(cellText(row, c)).includes(normalize(wanted));
  }));
}

/** Valor por el que se ordena una celda: número, texto o null (las celdas vacías van siempre al final). */
function sortValue(row: Row, col: DfResolvedColumn): number | string | null {
  const value = getByPath(row, col.key);
  if (value == null || value === '') return null;
  switch (col.type) {
    case 'number':
    case 'currency':
      return toNumber(value) ?? normalize(plainText(value));
    case 'date':
    case 'datetime':
      return parseDate(value)?.date.getTime() ?? normalize(plainText(value));
    case 'boolean':
      return value === true || value === 'true' ? 1 : 0;
    default:
      return normalize(formatCell(value, col));
  }
}

export function sortRows(rows: Row[], col: DfResolvedColumn, direction: 'asc' | 'desc'): Row[] {
  return sortRowsBy(rows, [{ col, direction }]);
}

/** Ordena por varias columnas: la primera manda y cada una desempata a la anterior. Los vacíos van al final en cualquier sentido. */
export function sortRowsBy(rows: Row[], sorts: { col: DfResolvedColumn; direction: 'asc' | 'desc' }[]): Row[] {
  const keyed = rows.map((row, index) => ({ row, index, values: sorts.map((s) => sortValue(row, s.col)) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < sorts.length; i++) {
      const [x, y] = [a.values[i], b.values[i]];
      if (x === null || y === null) {
        if (x === y) continue;
        return x === null ? 1 : -1;
      }
      const diff = typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'es', { numeric: true });
      if (diff !== 0) return diff * (sorts[i].direction === 'asc' ? 1 : -1);
    }
    return a.index - b.index;
  });
  return keyed.map((k) => k.row);
}
