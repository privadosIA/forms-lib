/**
 * Textos fijos de las tablas. Los que llevan `{llaves}` se rellenan al mostrarlos:
 * `{label}` (columna), `{text}` (búsqueda), `{n}` (filas marcadas), `{from}`, `{to}` y `{total}`.
 */
export interface DfTableTexts {
  search: string;
  actions: string;
  loading: string;
  retry: string;
  /** Texto cuando no hay filas y la tabla no define `emptyMessage`. */
  empty: string;
  /** Texto cuando la carga falla y la tabla no define `errorMessage`. */
  error: string;
  /** La búsqueda no encuentra nada. Admite `{text}`. */
  noResults: string;
  /** Los filtros de columna no dejan ninguna fila. */
  noResultsFiltered: string;
  rowsPerPage: string;
  previousPage: string;
  nextPage: string;
  /** Rango de la página. Admite `{from}`, `{to}` y `{total}`. */
  range: string;
  /** Opción «sin filtro» del desplegable de una columna. */
  all: string;
  /** Etiqueta del filtro de una columna. Admite `{label}`. */
  filterBy: string;
  /** Botón de la cabecera de una columna (`pinnableColumns`). Admite `{label}`. */
  pinColumn: string;
  unpinColumn: string;
  /** Pista de una cabecera que se puede arrastrar (`reorderableColumns`). */
  reorderHint: string;
  /** Borde de la cabecera que se arrastra (`resizableColumns`). Admite `{label}`. */
  resizeColumn: string;
  selectAll: string;
  selectRow: string;
  exportCsv: string;
  /** Con filas marcadas. Admite `{n}`. */
  exportSelection: string;
  exporting: string;
  exportFailed: string;
}

export const DEFAULT_TABLE_TEXTS: DfTableTexts = {
  search: 'Buscar',
  actions: 'Acciones',
  loading: 'Cargando…',
  retry: 'Reintentar',
  empty: 'No hay datos',
  error: 'No se pudieron cargar los datos',
  noResults: 'Ningún resultado para «{text}»',
  noResultsFiltered: 'Ningún resultado con los filtros aplicados',
  rowsPerPage: 'Filas por página',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  range: '{from}–{to} de {total}',
  all: 'Todos',
  filterBy: 'Filtrar por {label}',
  pinColumn: 'Fijar la columna {label}',
  unpinColumn: 'Soltar la columna {label}',
  reorderHint: 'Arrastra para mover la columna, o Alt + flechas con el teclado',
  resizeColumn: 'Cambiar el ancho de la columna {label} (flechas izquierda y derecha)',
  selectAll: 'Seleccionar todas las filas',
  selectRow: 'Seleccionar fila',
  exportCsv: 'Exportar CSV',
  exportSelection: 'Exportar selección ({n})',
  exporting: 'Exportando…',
  exportFailed: 'No se pudo exportar',
};

/** Juego completo en inglés: `provideDynamicForms({ tableTexts: EN_TABLE_TEXTS })`. */
export const EN_TABLE_TEXTS: DfTableTexts = {
  search: 'Search',
  actions: 'Actions',
  loading: 'Loading…',
  retry: 'Retry',
  empty: 'No data',
  error: 'The data could not be loaded',
  noResults: 'No results for «{text}»',
  noResultsFiltered: 'No results with the applied filters',
  rowsPerPage: 'Rows per page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  range: '{from}–{to} of {total}',
  all: 'All',
  filterBy: 'Filter by {label}',
  pinColumn: 'Pin column {label}',
  unpinColumn: 'Unpin column {label}',
  reorderHint: 'Drag to move the column, or Alt + arrow keys on the keyboard',
  resizeColumn: 'Resize column {label} (left and right arrow keys)',
  selectAll: 'Select all rows',
  selectRow: 'Select row',
  exportCsv: 'Export CSV',
  exportSelection: 'Export selection ({n})',
  exporting: 'Exporting…',
  exportFailed: 'The export failed',
};

/** Rellena las `{llaves}` de un texto; una llave sin valor se queda tal cual. */
export function fillText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}
