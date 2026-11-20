import { DfArrayTotalOp } from '../models/schema.model';
import { DfNumberFormat, formatAmount, formatNumber, parseAmount } from './currency';

/** Total ya resuelto por el adaptador: lo que `df-repeat` necesita para calcularlo y pintarlo. */
export interface DfResolvedTotal {
  label: string;
  op: DfArrayTotalOp;
  field?: string;
  /** Moneda del campo; sin ella el resultado se muestra como número. */
  currency?: string;
  numberFormat: DfNumberFormat;
}

/** Lee el valor numérico de una celda: un number, o el texto de un importe si se puede leer. */
function toNumber(value: unknown, total: DfResolvedTotal): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = parseAmount(value, total.numberFormat, total.currency);
  return parsed.ok ? parsed.value : null;
}

const filled = (v: unknown): boolean => v != null && v !== '' && !(typeof v === 'number' && Number.isNaN(v));

/** Calcula un total sobre las filas; null si no hay valores con los que calcular (media, mínimo, máximo). */
export function computeTotal(rows: unknown, total: DfResolvedTotal): number | null {
  const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  const cell = (row: Record<string, unknown> | null) => (total.field && row ? row[total.field] : undefined);

  if (total.op === 'count') return total.field ? list.filter((r) => filled(cell(r))).length : list.length;

  const values = list.map((r) => toNumber(cell(r), total)).filter((v): v is number => v !== null);
  if (total.op === 'sum') return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
  if (values.length === 0) return null;
  if (total.op === 'avg') return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  return total.op === 'min' ? Math.min(...values) : Math.max(...values);
}

/** "1.500,75 €" si el total viene de un campo currency; "1.500,75" si no; "—" sin valor. */
export function formatTotal(value: number | null, total: DfResolvedTotal): string {
  if (value === null) return '—';
  if (total.op === 'count' || !total.currency) return formatNumber(value, total.numberFormat);
  return formatAmount(value, total.currency, total.numberFormat);
}
