import { DfResolvedColumn, cellText } from './table';

type Row = Record<string, unknown>;

/** Separador de columnas: el de Excel con configuración regional española. */
const SEPARATOR = ';';
/** Marca de orden de bytes: sin ella Excel abre el UTF-8 como ANSI y estropea las tildes y la eñe. */
const BOM = '\uFEFF';

/**
 * Un texto que empieza por `=`, `+`, `@` o un control, o por `-` y algo que no es un número, lo evalúa Excel
 * como fórmula. Se antepone `'` para que se quede como texto.
 */
function neutralize(text: string): string {
  return /^[=+@\t\r]|^-(?![\d.,\s])/.test(text) ? `'${text}` : text;
}

function field(text: string): string {
  const safe = neutralize(text);
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV de las filas con lo que se ve en cada celda (importes y fechas ya formateados). Líneas con CRLF. */
export function toCsv(rows: Row[], cols: DfResolvedColumn[]): string {
  const lines = [cols.map((c) => field(c.label)), ...rows.map((r) => cols.map((c) => field(cellText(r, c))))];
  return BOM + lines.map((l) => l.join(SEPARATOR)).join('\r\n') + '\r\n';
}

/** Nombre de fichero seguro con extensión `.csv`: sin rutas ni caracteres raros. */
export function csvFileName(name: string): string {
  const base = name.replace(/\.csv$/i, '').replace(/[^A-Za-z0-9_. -]/g, '_').replace(/^[. ]+/, '').slice(0, 100);
  return `${base || 'tabla'}.csv`;
}
