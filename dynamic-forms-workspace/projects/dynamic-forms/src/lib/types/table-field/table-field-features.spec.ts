import { Observable, of } from 'rxjs';
import { DfTablePage, DfTableProvider, DfTableRequest, DfTableSelectEvent } from '../../models/config.model';
import { DfNode, DfTable } from '../../models/schema.model';
import { renderForm } from '../../testing/render-form';

type Row = Record<string, unknown>;

const filas: Row[] = [
  { id: 1, nombre: 'Peña', importe: 1500.5, activo: true, estado: 'P' },
  { id: 2, nombre: 'Álvaro', importe: 20, activo: false, estado: 'A' },
  { id: 3, nombre: 'Zoe', importe: 300, activo: true, estado: 'A' },
  { id: 4, nombre: '=SUMA(A1)', importe: -5, activo: null, estado: 'P' },
];

const tabla = (extra: Partial<DfTable> = {}): DfNode => ({
  type: 'table',
  id: 'clientes',
  columns: [
    { key: 'nombre', label: 'Nombre', filter: true },
    { key: 'importe', label: 'Importe', type: 'currency' },
    { key: 'activo', label: 'Activo', type: 'boolean', filter: true },
    { key: 'estado', label: 'Estado', type: 'map', map: { P: 'Pendiente', A: 'Aprobado' }, filter: true },
  ],
  rows: filas,
  ...extra,
});

interface Page {
  $$: <T extends Element = HTMLElement>(s: string) => T[];
}
const names = (f: Page) => f.$$('.df-table tbody tr:not(.df-table__empty)').map((tr) => tr.querySelector('td:not(.df-table__check)')?.textContent?.trim());
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Tablas: filtros por columna', () => {
  it('una columna con filter muestra su control: texto para las normales, desplegable para map y boolean', async () => {
    const f = await renderForm([tabla()]);
    const row = f.$$('.df-table__filters th');
    expect(row).toHaveLength(4);
    expect(row[0].querySelector('input[type=search]')).toBeTruthy();
    expect(row[1].children).toHaveLength(0);
    expect(Array.from(row[2].querySelectorAll('option')).map((o) => o.textContent?.trim())).toEqual(['Todos', 'Sí', 'No']);
    expect(Array.from(row[3].querySelectorAll('option')).map((o) => o.textContent?.trim())).toEqual(['Todos', 'Pendiente', 'Aprobado']);
  });

  it('sin ninguna columna con filter no hay fila de filtros', async () => {
    const f = await renderForm([tabla({ columns: [{ key: 'nombre', label: 'Nombre' }] })]);
    expect(f.$('.df-table__filters')).toBeNull();
  });

  it('el texto filtra sin mayúsculas ni acentos y el desplegable por valor exacto; se combinan', async () => {
    const f = await renderForm([tabla()]);
    await f.type('.df-table__filters th:nth-child(1) input', 'pena');
    expect(names(f)).toEqual(['Peña']);
    await f.type('.df-table__filters th:nth-child(1) input', '');
    await f.choose('.df-table__filters th:nth-child(4) select', 'Aprobado');
    expect(names(f)).toEqual(['Álvaro', 'Zoe']);
    await f.choose('.df-table__filters th:nth-child(3) select', 'Sí');
    expect(names(f)).toEqual(['Zoe']);
  });

  it('se combina con el buscador global y avisa cuando no queda nada', async () => {
    const f = await renderForm([tabla({ filter: true })]);
    await f.choose('.df-table__filters th:nth-child(4) select', 'Pendiente');
    await f.type('.df-table__search', 'zoe');
    expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('Ningún resultado para «zoe»');
    await f.type('.df-table__search', '');
    await f.type('.df-table__filters th:nth-child(1) input', 'zzz');
    expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('Ningún resultado con los filtros aplicados');
  });

  it('un filtro vuelve a la primera página', async () => {
    const f = await renderForm([tabla({ pageSize: 2 })]);
    await f.click('.df-table__page:last-child');
    expect(f.$('.df-table__range')?.textContent).toBe('3–4 de 4');
    await f.choose('.df-table__filters th:nth-child(4) select', 'Pendiente');
    expect(f.$('.df-table__range')?.textContent).toBe('1–2 de 2');
  });
});

describe('Tablas: selección múltiple', () => {
  const select = (f: { host: { dynamicForm: { tableSelect: { subscribe: (fn: (e: DfTableSelectEvent) => void) => void } } } }) => {
    const events: DfTableSelectEvent[] = [];
    f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e));
    return events;
  };
  const box = (f: Page, i: number) => f.$$<HTMLInputElement>('.df-table tbody .df-table__check input')[i];

  const shiftClick = async (f: { $: (s: string) => HTMLElement | null; stable(): Promise<void> }, selector: string) => {
    f.$(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await f.stable();
  };

  it('Shift+clic marca el rango entre la última fila pulsada y esta, sin quitar lo marcado', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple' })]);
    const events = select(f);
    await f.click('.df-table tbody tr:nth-child(2)');
    await shiftClick(f, '.df-table tbody tr:nth-child(4)');
    expect(events.at(-1)!.rows.map((r) => r['nombre'])).toEqual(['Álvaro', 'Zoe', '=SUMA(A1)']);
    await f.click('.df-table tbody tr:nth-child(1)');
    expect(events.at(-1)!.rows).toHaveLength(4);
  });

  it('Shift+clic funciona también desde la casilla y hacia arriba', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple' })]);
    const events = select(f);
    await f.click('.df-table tbody tr:nth-child(3) .df-table__check input');
    await shiftClick(f, '.df-table tbody tr:nth-child(1) .df-table__check input');
    expect(events.at(-1)!.rows.map((r) => r['nombre'])).toEqual(['Zoe', 'Peña', 'Álvaro']);
  });

  it('selectAll() y clearSelection() del formulario marcan y vacían la selección y emiten changed', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple', pageSize: 2 })]);
    const events = select(f);
    await f.click('.df-table tbody tr:nth-child(1)');
    f.host.dynamicForm.selectAll('clientes');
    await f.stable();
    expect(events.at(-1)!.rows).toHaveLength(4);
    expect(events.at(-1)!.changed).toEqual({ rows: expect.any(Array), selected: true });
    expect(events.at(-1)!.changed.rows.map((r) => r['nombre'])).toEqual(['Álvaro', 'Zoe', '=SUMA(A1)']);
    expect(box(f, 0).checked).toBe(true);
    f.host.dynamicForm.clearSelection();
    await f.stable();
    expect(events.at(-1)!.rows).toEqual([]);
    expect(events.at(-1)!.changed.selected).toBe(false);
    expect(events.at(-1)!.changed.rows).toHaveLength(4);
    expect(box(f, 0).checked).toBe(false);
    const n = events.length;
    f.host.dynamicForm.clearSelection('clientes');
    f.host.dynamicForm.selectAll('no-existe');
    expect(events).toHaveLength(n);
  });

  it('Shift+clic sin una fila de partida marca solo esa', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple' })]);
    const events = select(f);
    await shiftClick(f, '.df-table tbody tr:nth-child(3)');
    expect(events.at(-1)!.rows.map((r) => r['nombre'])).toEqual(['Zoe']);
  });

  it('añade una casilla por fila y emite la selección completa en rows (row es null)', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple' })]);
    const events = select(f);
    expect(f.$$('.df-table tbody .df-table__check input')).toHaveLength(4);
    await f.click('.df-table tbody tr:nth-child(1) .df-table__check input');
    await f.click('.df-table tbody tr:nth-child(3)');
    expect(events.map((e) => e.rows.map((r) => r['nombre']))).toEqual([['Peña'], ['Peña', 'Zoe']]);
    expect(events[1].row).toBeNull();
    expect(box(f, 0).checked).toBe(true);
    expect(box(f, 1).checked).toBe(false);
    await f.click('.df-table tbody tr:nth-child(1) .df-table__check input');
    expect(events[2].rows.map((r) => r['nombre'])).toEqual(['Zoe']);
  });

  it('la casilla de la cabecera marca todas las filas filtradas, aunque estén en otra página, y las quita', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple', pageSize: 2 })]);
    const events = select(f);
    await f.choose('.df-table__filters th:nth-child(5) select', 'Pendiente');
    await f.click('thead .df-table__check input');
    expect(events.at(-1)?.rows.map((r) => r['nombre'])).toEqual(['Peña', '=SUMA(A1)']);
    expect(f.$<HTMLInputElement>('thead .df-table__check input')?.checked).toBe(true);
    await f.click('thead .df-table__check input');
    expect(events.at(-1)?.rows).toEqual([]);
  });

  it('la casilla de la cabecera queda indeterminada con una selección parcial', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple' })]);
    await f.click('.df-table tbody tr:nth-child(1) .df-table__check input');
    const head = f.$<HTMLInputElement>('thead .df-table__check input')!;
    expect(head.indeterminate).toBe(true);
    expect(head.checked).toBe(false);
  });

  it('selectable: true sigue siendo selección única, y ahora también emite rows', async () => {
    const f = await renderForm([tabla({ selectable: true })]);
    const events = select(f);
    expect(f.$('.df-table__check')).toBeNull();
    await f.click('.df-table tbody tr:nth-child(2)');
    expect(events[0].row?.['nombre']).toBe('Álvaro');
    expect(events[0].rows).toEqual([filas[1]]);
    await f.click('.df-table tbody tr:nth-child(2)');
    expect(events[1]).toMatchObject({ row: null, rows: [] });
  });
});

describe('Tablas: exportar a CSV', () => {
  let saved: { name: string; blob: Blob }[];
  let lastBlob: Blob;

  beforeEach(() => {
    saved = [];
    URL.createObjectURL = vi.fn((b: Blob) => { lastBlob = b; return 'blob:test'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, blob: lastBlob });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  // Blob.text() decodifica como UTF-8 y descarta el BOM, que se comprueba aparte con los bytes.
  const csv = async (i = 0) => saved[i].blob.text();

  it('sin exportCsv no hay botón', async () => {
    const f = await renderForm([tabla()]);
    expect(f.$('.df-table__export')).toBeNull();
  });

  it('descarga lo que se ve: filas filtradas y ordenadas, con importes y valores ya formateados', async () => {
    const f = await renderForm([tabla({ exportCsv: true })]);
    await f.choose('.df-table__filters th:nth-child(4) select', 'Aprobado');
    await f.click('.df-table__export');
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('clientes.csv');
    const lines = (await csv()).split('\r\n');
    expect(lines[0]).toBe('Nombre;Importe;Activo;Estado');
    expect(lines[1]).toMatch(/^Álvaro;20,00\s€;No;Aprobado$/);
    expect(lines[2]).toMatch(/^Zoe;300,00\s€;Sí;Aprobado$/);
    expect(lines).toHaveLength(4);
    expect(Array.from(new Uint8Array(await saved[0].blob.arrayBuffer()).slice(0, 3))).toEqual([0xEF, 0xBB, 0xBF]); // BOM de UTF-8 para Excel
  });

  it('usa el filename del esquema, protege las fórmulas y entrecomilla ; comillas y saltos de línea', async () => {
    const rows = [{ nombre: '=SUMA(A1)', nota: 'a;b "c"\nd', importe: -5 }, { nombre: '-cmd', nota: '', importe: 1 }];
    const f = await renderForm([{
      type: 'table', id: 't', rows, exportCsv: { filename: 'mi informe' },
      columns: [{ key: 'nombre', label: 'Nombre' }, { key: 'nota', label: 'Nota' }, { key: 'importe', label: 'Importe', type: 'number' }],
    }]);
    await f.click('.df-table__export');
    expect(saved[0].name).toBe('mi informe.csv');
    const text = await csv();
    expect(text).toBe('Nombre;Nota;Importe\r\n\'=SUMA(A1);"a;b ""c""\nd";-5\r\n\'-cmd;;1\r\n');
  });

  it('con filas marcadas el botón exporta solo la selección', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple', exportCsv: true })]);
    expect(f.$('.df-table__export')?.textContent?.trim()).toBe('Exportar CSV');
    await f.click('.df-table tbody tr:nth-child(3) .df-table__check input');
    expect(f.$('.df-table__export')?.textContent?.trim()).toBe('Exportar selección (1)');
    await f.click('.df-table__export');
    const lines = (await csv()).trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^Zoe;/);
  });
});

class FakeProvider implements DfTableProvider {
  static calls: DfTableRequest[] = [];
  load(_e: string, r: DfTableRequest): Observable<DfTablePage> {
    FakeProvider.calls.push(r);
    const rows = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, nombre: `Fila ${i + 1}`, estado: i % 2 ? 'A' : 'P' }))
      .filter((x) => !r.columnFilters['estado'] || x.estado === r.columnFilters['estado']);
    const size = r.pageSize ?? rows.length;
    return of({ rows: rows.slice(r.page * size, r.page * size + size), total: rows.length });
  }
}

describe('Tablas con servicio: filtros por columna, selección y exportación', () => {
  const config = { tableProvider: FakeProvider };
  const servidor = (extra: Partial<DfTable> = {}): DfNode => ({
    type: 'table', id: 'datos', pageSize: 5,
    source: { endpoint: '/api/datos', mode: 'server' },
    columns: [{ key: 'nombre', label: 'Nombre' }, { key: 'estado', label: 'Estado', type: 'map', map: { P: 'Pendiente', A: 'Aprobado' }, filter: true }],
    ...extra,
  });
  beforeEach(() => { FakeProvider.calls = []; });

  it('envía los filtros de columna al servicio, sin vacíos, tras la pausa, y vuelve a la primera página', async () => {
    const f = await renderForm([servidor()], { config });
    expect(FakeProvider.calls[0].columnFilters).toEqual({});
    await f.click('.df-table__page:last-child');
    await f.choose('.df-table__filters th:nth-child(2) select', 'Aprobado', false);
    expect(FakeProvider.calls).toHaveLength(2); // todavía no: se espera a que el usuario pare
    await wait(350);
    await f.stable();
    expect(FakeProvider.calls[2]).toMatchObject({ page: 0, columnFilters: { estado: 'A' } });
    expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 11');
  });

  it('en modo client no se envían filtros: el servicio devuelve todo y se filtra en el cliente', async () => {
    const f = await renderForm([servidor({ source: { endpoint: '/api/datos', mode: 'client' }, pageSize: undefined })], { config });
    await f.choose('.df-table__filters th:nth-child(2) select', 'Aprobado');
    expect(FakeProvider.calls).toHaveLength(1);
    expect(FakeProvider.calls[0].columnFilters).toEqual({});
    expect(f.$$('.df-table tbody tr')).toHaveLength(11);
  });

  it('con selectionKey la selección sobrevive al cambio de página; sin ella se vacía', async () => {
    const withKey = await renderForm([servidor({ selectable: 'multiple', selectionKey: 'id' })], { config });
    await withKey.click('.df-table tbody tr:nth-child(1) .df-table__check input');
    await withKey.click('.df-table__page:last-child');
    await withKey.click('.df-table tbody tr:nth-child(1) .df-table__check input');
    await withKey.click('.df-table__page:first-of-type');
    expect(withKey.$<HTMLInputElement>('.df-table tbody tr:nth-child(1) .df-table__check input')?.checked).toBe(true);
  });

  it('sin selectionKey, cambiar de página vacía la selección y lo avisa', async () => {
    const f = await renderForm([servidor({ selectable: 'multiple' })], { config });
    const events: DfTableSelectEvent[] = [];
    f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e));
    await f.click('.df-table tbody tr:nth-child(1) .df-table__check input');
    await f.click('.df-table__page:last-child');
    await wait(0);
    expect(events.at(-1)).toMatchObject({ row: null, rows: [] });
    expect(f.$<HTMLInputElement>('.df-table tbody tr:nth-child(1) .df-table__check input')?.checked).toBe(false);
  });

  it('exportar en modo server pide al servicio todas las filas del filtro, no solo la página', async () => {
    const saved: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { saved.push(b); return 'blob:x'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const f = await renderForm([servidor({ exportCsv: true })], { config });
    await f.click('.df-table__export');
    const last = FakeProvider.calls.at(-1)!;
    expect(last).toMatchObject({ page: 0, pageSize: 23, columnFilters: {} });
    expect((await saved[0].text()).trim().split('\r\n')).toHaveLength(24);
    vi.restoreAllMocks();
  });
});

describe('Tablas: columnas fijas', () => {
  it('las columnas frozen llevan la clase y su left sale de una variable CSS', async () => {
    const f = await renderForm([tabla({ columns: [
      { key: 'id', label: 'Id', frozen: true },
      { key: 'nombre', label: 'Nombre', frozen: true },
      { key: 'importe', label: 'Importe', type: 'currency' },
    ] })]);
    const heads = f.$$('.df-table thead tr:first-child th');
    expect(heads.map((h) => h.classList.contains('is-frozen'))).toEqual([true, true, false]);
    expect(heads[1].style.left).toBe('var(--df-frozen-1)');
    expect(heads[2].style.left).toBe('');
    const cells = f.$$('.df-table tbody tr:first-child td');
    expect(cells.map((c) => c.classList.contains('is-frozen'))).toEqual([true, true, false]);
  });

  it('con selección múltiple la casilla también queda fija', async () => {
    const f = await renderForm([tabla({ selectable: 'multiple', columns: [{ key: 'nombre', label: 'Nombre', frozen: true }] })]);
    expect(f.$('.df-table thead th.df-table__check')?.classList.contains('is-frozen')).toBe(true);
    expect(f.$<HTMLElement>('.df-table tbody td.df-table__check')?.style.left).toBe('var(--df-frozen-check)');
  });

  it('sin columnas frozen no hay nada fijo', async () => {
    const f = await renderForm([tabla()]);
    expect(f.$$('.df-table .is-frozen')).toHaveLength(0);
  });
});

describe('Tablas: textos traducidos', () => {
  const en = {
    search: 'Search', actions: 'Actions', rowsPerPage: 'Rows per page', range: '{from}–{to} of {total}',
    noResults: 'No results for «{text}»', all: 'All', filterBy: 'Filter by {label}', selectAll: 'Select all rows',
    exportCsv: 'Export CSV', exportSelection: 'Export selection ({n})', empty: 'No data',
  };

  it('sin configurar quedan en español', async () => {
    const f = await renderForm([tabla({ filter: true, pageSize: 2, actions: [{ name: 'ver', label: 'Ver' }] })]);
    expect(f.$('.df-table__filter span')?.textContent).toBe('Buscar');
    expect(f.$('.df-table__actions-head')?.textContent).toBe('Acciones');
    expect(f.$('.df-table__page-size span')?.textContent).toBe('Filas por página');
    expect(f.$('.df-table__range')?.textContent).toBe('1–2 de 4');
  });

  it('tableTexts cambia los textos fijos y respeta los que no se indican', async () => {
    const f = await renderForm([tabla({ filter: true, pageSize: 2, exportCsv: true, selectable: 'multiple', actions: [{ name: 'ver', label: 'Ver' }] })], { config: { tableTexts: en } });
    expect(f.$('.df-table__filter span')?.textContent).toBe('Search');
    expect(f.$('.df-table__actions-head')?.textContent).toBe('Actions');
    expect(f.$('.df-table__page-size span')?.textContent).toBe('Rows per page');
    expect(f.$('.df-table__range')?.textContent).toBe('1–2 of 4');
    expect(f.$('.df-table__export')?.textContent?.trim()).toBe('Export CSV');
    expect(f.$('.df-table__filters select')?.getAttribute('aria-label')).toBe('Filter by Activo');
    expect(f.$('.df-table thead .df-table__check input')?.getAttribute('aria-label')).toBe('Select all rows');
    expect(Array.from(f.$$('.df-table__filters th:nth-child(4) option')).map((o) => o.textContent?.trim())).toEqual(['All', 'Sí', 'No']);
    expect(f.$('.df-table__page')?.getAttribute('aria-label')).toBe('Página anterior');
  });

  it('el mensaje vacío sale de tableTexts', async () => {
    const f = await renderForm([tabla({ filter: true, rows: [] })], { config: { tableTexts: en } });
    expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('No data');
  });

  it('el emptyMessage del esquema gana al de tableTexts', async () => {
    const f = await renderForm([tabla({ rows: [], emptyMessage: 'Vacío' })], { config: { tableTexts: en } });
    expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('Vacío');
  });

  it('las llaves del mensaje de búsqueda se rellenan', async () => {
    const f = await renderForm([tabla({ filter: true })], { config: { tableTexts: en } });
    await f.type('.df-table__search', 'qqq');
    expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('No results for «qqq»');
  });
});

describe('Tablas: columnas que el usuario fija', () => {
  const cols = [
    { key: 'id', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'importe', label: 'Importe', type: 'currency' as const },
  ];
  const heads = (f: Page) => f.$$('.df-table thead tr:first-child th').map((h) => h.querySelector('.df-table__sort')?.textContent?.trim() ?? h.textContent?.trim());
  const frozen = (f: Page) => f.$$('.df-table thead tr:first-child th').map((h) => h.classList.contains('is-frozen'));
  const pin = (n: number) => `.df-table thead tr:first-child th:nth-child(${n}) .df-table__pin`;

  it('sin pinnableColumns no hay botones', async () => {
    const f = await renderForm([tabla({ columns: cols })]);
    expect(f.$$('.df-table__pin')).toHaveLength(0);
  });

  it('con pinnableColumns hay un botón por columna, con su nombre accesible y sin pulsar', async () => {
    const f = await renderForm([tabla({ columns: cols, pinnableColumns: true })]);
    const buttons = f.$$('.df-table__pin');
    expect(buttons).toHaveLength(3);
    expect(buttons[1].getAttribute('aria-label')).toBe('Fijar la columna Nombre');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('fijar una columna la pasa al final de las fijas; soltarla la devuelve a su sitio', async () => {
    const f = await renderForm([tabla({ columns: cols, pinnableColumns: true })]);
    await f.click(pin(3));
    expect(heads(f)).toEqual(['Importe', 'Id', 'Nombre']);
    expect(frozen(f)).toEqual([true, false, false]);
    expect(f.$(pin(1))?.getAttribute('aria-label')).toBe('Soltar la columna Importe');
    expect(f.$(pin(1))?.getAttribute('aria-pressed')).toBe('true');
    await f.click(pin(3));
    expect(heads(f)).toEqual(['Importe', 'Nombre', 'Id']);
    expect(frozen(f)).toEqual([true, true, false]);
    await f.click(pin(1));
    expect(heads(f)).toEqual(['Nombre', 'Id', 'Importe']);
    expect(frozen(f)).toEqual([true, false, false]);
  });

  it('parte de lo que diga el esquema y deja soltar una columna fija', async () => {
    const f = await renderForm([tabla({ columns: [{ ...cols[0], frozen: true }, cols[1], cols[2]], pinnableColumns: true })]);
    expect(frozen(f)).toEqual([true, false, false]);
    expect(f.$(pin(1))?.getAttribute('aria-pressed')).toBe('true');
    await f.click(pin(1));
    expect(frozen(f)).toEqual([false, false, false]);
    expect(heads(f)).toEqual(['Id', 'Nombre', 'Importe']);
  });

  it('las celdas siguen a su columna y las acciones y el orden siguen funcionando', async () => {
    const f = await renderForm([tabla({ columns: cols, rows: [{ id: 1, nombre: 'Zoe', importe: 5 }, { id: 2, nombre: 'Ana', importe: 7 }], pinnableColumns: true })]);
    await f.click(pin(2));
    expect(f.$$('.df-table tbody tr:first-child td').map((c) => c.textContent?.trim())).toEqual(['Zoe', '1', expect.stringContaining('5')]);
    await f.click('.df-table thead tr:first-child th:nth-child(1) .df-table__sort');
    expect(f.$$('.df-table tbody tr td:first-child').map((c) => c.textContent?.trim())).toEqual(['Ana', 'Zoe']);
  });

  it('los textos de los botones salen de tableTexts', async () => {
    const f = await renderForm([tabla({ columns: cols, pinnableColumns: true })], { config: { tableTexts: { pinColumn: 'Pin {label}', unpinColumn: 'Unpin {label}' } } });
    expect(f.$(pin(2))?.getAttribute('aria-label')).toBe('Pin Nombre');
    await f.click(pin(2));
    expect(f.$(pin(1))?.getAttribute('aria-label')).toBe('Unpin Nombre');
  });
});

describe('Tablas: recordar el estado', () => {
  const cols = [
    { key: 'nombre', label: 'Nombre', filter: true },
    { key: 'importe', label: 'Importe', type: 'currency' as const },
    { key: 'estado', label: 'Estado', type: 'map' as const, map: { P: 'Pendiente', A: 'Aprobado' }, filter: true },
  ];
  const data = tabla({ id: 'clientes', columns: cols, filter: true, pageSize: 2, pageSizeOptions: [2, 4], pinnableColumns: true });
  const saved = (store: Storage = window.sessionStorage) => JSON.parse(store.getItem('df-table:clientes') ?? 'null');

  beforeEach(() => {
    // Este jsdom no trae localStorage: se pone uno en memoria con la misma interfaz que usa la tabla.
    if (!window.localStorage) {
      const items = new Map<string, string>();
      const memory = {
        getItem: (k: string) => items.get(k) ?? null,
        setItem: (k: string, v: string) => void items.set(k, String(v)),
        clear: () => items.clear(),
        get length() { return items.size; },
      };
      Object.defineProperty(window, 'localStorage', { value: memory, configurable: true });
    }
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('sin persistState no guarda nada', async () => {
    const f = await renderForm([data]);
    await f.type('.df-table__search', 'zoe');
    expect(window.sessionStorage.length + window.localStorage.length).toBe(0);
  });

  it('guarda el buscador, el orden, el tamaño de página y los filtros de columna', async () => {
    const f = await renderForm([{ ...data, persistState: true } as DfNode]);
    await f.type('.df-table__search', 'zoe');
    await f.click('.df-table thead tr:first-child th:nth-child(2) .df-table__sort');
    await f.choose('.df-table__page-size select', '4');
    await f.type('.df-table__filters th:nth-child(1) input', 'z');
    expect(saved()).toEqual({
      sorts: [{ key: 'importe', direction: 'asc' }], filter: 'zoe', columnFilters: { nombre: 'z' }, pageSize: 4,
    });
  });

  it("persistState: 'local' usa localStorage", async () => {
    const f = await renderForm([{ ...data, persistState: 'local' } as DfNode]);
    await f.type('.df-table__search', 'a');
    expect(saved(window.localStorage)?.filter).toBe('a');
    expect(window.sessionStorage.length).toBe(0);
  });

  it('restaura lo guardado al volver a pintar la tabla', async () => {
    window.sessionStorage.setItem('df-table:clientes', JSON.stringify({
      sort: { key: 'importe', direction: 'desc' }, filter: 'a', columnFilters: { estado: 'A' }, pageSize: 4, pinned: ['importe'],
    }));
    const f = await renderForm([{ ...data, persistState: true } as DfNode]);
    expect(f.$<HTMLInputElement>('.df-table__search')?.value).toBe('a');
    expect(f.$<HTMLSelectElement>('.df-table__filters select')?.value).toBe('A');
    expect(f.$<HTMLSelectElement>('.df-table__page-size select')?.value).toBe('4');
    expect(f.$('.df-table thead tr:first-child th:nth-child(1)')?.getAttribute('aria-sort')).toBe('descending');
    expect(f.$('.df-table thead tr:first-child th:nth-child(1)')?.classList.contains('is-frozen')).toBe(true);
  });

  it('un orden quitado por el usuario gana al orden inicial del esquema', async () => {
    // `sort: null` es el formato de antes de multiSort; se sigue entendiendo.
    window.sessionStorage.setItem('df-table:clientes', JSON.stringify({ sort: null }));
    const f = await renderForm([{ ...data, persistState: true, sort: { key: 'nombre', direction: 'asc' } } as DfNode]);
    expect(f.$$('.df-table thead th[aria-sort="ascending"], .df-table thead th[aria-sort="descending"]')).toHaveLength(0);
  });

  it('ignora lo guardado que no encaja: JSON roto, columnas que ya no existen, tamaños fuera de las opciones', async () => {
    window.sessionStorage.setItem('df-table:clientes', JSON.stringify({
      sort: { key: 'borrada' }, columnFilters: { borrada: 'x', importe: 'y' }, pageSize: 7, pinned: ['borrada'], filter: 3,
    }));
    const f = await renderForm([{ ...data, persistState: true } as DfNode]);
    expect(f.$<HTMLSelectElement>('.df-table__page-size select')?.value).toBe('2');
    expect(f.$<HTMLInputElement>('.df-table__search')?.value).toBe('');
    expect(f.$$('.df-table .is-frozen')).toHaveLength(0);
  });

  it('stateKey separa el estado de dos tablas con el mismo id', async () => {
    const f = await renderForm([{ ...data, persistState: true, stateKey: 'otra' } as DfNode]);
    await f.type('.df-table__search', 'q');
    expect(window.sessionStorage.getItem('df-table:otra')).toBeTruthy();
    expect(window.sessionStorage.getItem('df-table:clientes')).toBeNull();
  });

  it('el almacén roto no tumba la tabla', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('lleno'); });
    const f = await renderForm([{ ...data, persistState: true } as DfNode]);
    await f.type('.df-table__search', 'zoe');
    expect(f.$('.df-table')).toBeTruthy();
    vi.restoreAllMocks();
  });
});

describe('Tablas: columnas que el usuario reordena', () => {
  const cols = [
    { key: 'id', label: 'Id' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'importe', label: 'Importe', type: 'currency' as const },
    { key: 'estado', label: 'Estado' },
  ];
  const data = (extra: Partial<DfTable> = {}) => tabla({ id: 'clientes', columns: cols, rows: [{ id: 1, nombre: 'Zoe', importe: 5, estado: 'P' }], reorderableColumns: true, ...extra });
  const th = (n: number) => `.df-table thead tr:first-child th:nth-child(${n})`;
  const heads = (f: Page) => f.$$('.df-table thead tr:first-child th').map((h) => h.dataset['key']);
  const drag = async (f: Page & { $: (s: string) => HTMLElement | null; stable(): Promise<void> }, from: string, to: string) => {
    const dataTransfer = { setData: () => undefined, effectAllowed: '', dropEffect: '' };
    const fire = (el: Element, type: string) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'dataTransfer', { value: dataTransfer });
      el.dispatchEvent(e);
    };
    fire(f.$(from)!, 'dragstart');
    fire(f.$(to)!, 'dragover');
    fire(f.$(to)!, 'drop');
    fire(f.$(from)!, 'dragend');
    await f.stable();
  };
  const alt = async (f: { $: (s: string) => HTMLElement | null; stable(): Promise<void> }, selector: string, key: string) => {
    f.$(selector)!.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, cancelable: true }));
    await f.stable();
  };

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('sin reorderableColumns las cabeceras no se arrastran', async () => {
    const f = await renderForm([data({ reorderableColumns: false })]);
    expect(f.$(th(1))?.getAttribute('draggable')).toBeNull();
  });

  it('arrastrar una cabecera sobre otra la deja en su sitio, hacia la derecha y hacia la izquierda', async () => {
    const f = await renderForm([data()]);
    expect(f.$(th(1))?.getAttribute('draggable')).toBe('true');
    await drag(f, th(1), th(3));
    expect(heads(f)).toEqual(['nombre', 'importe', 'id', 'estado']);
    await drag(f, th(4), th(1));
    expect(heads(f)).toEqual(['estado', 'nombre', 'importe', 'id']);
    expect(f.$$('.df-table tbody tr:first-child td').map((c) => c.textContent?.trim())).toEqual(['P', 'Zoe', expect.stringContaining('5'), '1']);
  });

  it('Alt + flechas mueve la columna un sitio y no pasa de los extremos', async () => {
    const f = await renderForm([data()]);
    await alt(f, `${th(2)} .df-table__sort`, 'ArrowRight');
    expect(heads(f)).toEqual(['id', 'importe', 'nombre', 'estado']);
    await alt(f, `${th(1)} .df-table__sort`, 'ArrowLeft');
    expect(heads(f)).toEqual(['id', 'importe', 'nombre', 'estado']);
    await alt(f, `${th(3)} .df-table__sort`, 'ArrowLeft');
    expect(heads(f)).toEqual(['id', 'nombre', 'importe', 'estado']);
  });

  it('una fija no se mezcla con las normales: arrastrar entre grupos no hace nada', async () => {
    const f = await renderForm([data({ columns: [{ ...cols[0], frozen: true }, { ...cols[1], frozen: true }, cols[2], cols[3]] })]);
    await drag(f, th(1), th(3));
    expect(heads(f)).toEqual(['id', 'nombre', 'importe', 'estado']);
    await drag(f, th(1), th(2));
    expect(heads(f)).toEqual(['nombre', 'id', 'importe', 'estado']);
    await drag(f, th(4), th(3));
    expect(heads(f)).toEqual(['nombre', 'id', 'estado', 'importe']);
  });

  it('con columnas fijables, soltar una columna fijada la devuelve a su sitio en el orden elegido', async () => {
    const f = await renderForm([data({ pinnableColumns: true })]);
    await drag(f, th(2), th(4));
    expect(heads(f)).toEqual(['id', 'importe', 'estado', 'nombre']);
    await f.click(`${th(3)} .df-table__pin`);
    expect(heads(f)).toEqual(['estado', 'id', 'importe', 'nombre']);
    await f.click(`${th(1)} .df-table__pin`);
    expect(heads(f)).toEqual(['id', 'importe', 'estado', 'nombre']);
  });

  it('se recuerda con persistState', async () => {
    const f = await renderForm([data({ persistState: true })]);
    await drag(f, th(1), th(3));
    expect(JSON.parse(window.sessionStorage.getItem('df-table:clientes')!).order).toEqual(['nombre', 'importe', 'id', 'estado']);
  });

  it('al restaurar, las columnas que ya no existen se ignoran y las nuevas van al final', async () => {
    window.sessionStorage.setItem('df-table:clientes', JSON.stringify({ order: ['estado', 'borrada', 'id'] }));
    const f = await renderForm([data({ persistState: true })]);
    expect(heads(f)).toEqual(['estado', 'id', 'nombre', 'importe']);
  });
});

describe('Tablas: columnas que el usuario redimensiona', () => {
  const cols = [
    { key: 'id', label: 'Id', col: 1 },
    { key: 'nombre', label: 'Nombre', col: 3 },
    { key: 'estado', label: 'Estado', col: 2 },
  ];
  const data = (extra: Partial<DfTable> = {}) => tabla({ id: 'clientes', columns: cols, rows: [{ id: 1, nombre: 'Zoe', estado: 'P' }], resizableColumns: true, ...extra });
  const handle = (n: number) => `.df-table thead tr:first-child th:nth-child(${n}) .df-table__resizer`;
  const colStyles = (f: Page) => f.$$('.df-table colgroup col').map((c) => c.style.width);
  type Harness = Page & { $: (s: string) => HTMLElement | null; stable(): Promise<void> };
  const pointer = async (f: Harness, selector: string, type: string, x: number) => {
    f.$(selector)!.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x }));
    await f.stable();
  };
  const dragBy = async (f: Harness, selector: string, dx: number) => {
    await pointer(f, selector, 'pointerdown', 200);
    await pointer(f, selector, 'pointermove', 200 + dx);
    await pointer(f, selector, 'pointerup', 200 + dx);
  };

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('sin resizableColumns no hay bordes que arrastrar y los anchos son porcentajes', async () => {
    const f = await renderForm([data({ resizableColumns: false })]);
    expect(f.$$('.df-table__resizer')).toHaveLength(0);
    expect(colStyles(f)).toEqual(['16.7%', '50%', '33.3%']);
  });

  it('con resizableColumns cada cabecera tiene su borde, con nombre accesible', async () => {
    const f = await renderForm([data()]);
    expect(f.$$('.df-table__resizer')).toHaveLength(3);
    expect(f.$(handle(2))?.getAttribute('aria-label')).toBe('Cambiar el ancho de la columna Nombre (flechas izquierda y derecha)');
  });

  it('arrastrar un borde pasa todos los anchos a píxeles y cambia solo el de esa columna', async () => {
    const f = await renderForm([data()]);
    await dragBy(f, handle(2), 60);
    expect(colStyles(f)).toEqual(['100px', '160px', '100px']);
    expect(f.$<HTMLElement>('.df-table__table')?.style.width).toBe('360px');
    expect(f.$('.df-table__table')?.classList.contains('is-resized')).toBe(true);
    await dragBy(f, handle(2), -500);
    expect(colStyles(f)[1]).toBe('48px');
  });

  it('las flechas cambian el ancho del borde enfocado y doble clic restablece', async () => {
    const f = await renderForm([data()]);
    const key = async (k: string, shiftKey = false) => {
      f.$(handle(1))!.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
      await f.stable();
    };
    await key('ArrowRight');
    expect(colStyles(f)[0]).toBe('110px');
    await key('ArrowLeft', true);
    expect(colStyles(f)[0]).toBe('60px');
    f.$(handle(1))!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await f.stable();
    expect(colStyles(f)).toEqual(['16.7%', '50%', '33.3%']);
    expect(f.$('.df-table__table')?.classList.contains('is-resized')).toBe(false);
  });

  it('se recuerda con persistState y se ignora si no están todas las columnas', async () => {
    const f = await renderForm([data({ persistState: true })]);
    await dragBy(f, handle(3), 40);
    expect(JSON.parse(window.sessionStorage.getItem('df-table:clientes')!).widths).toEqual({ id: 100, nombre: 100, estado: 140 });
  });

  it('al restaurar usa los anchos guardados', async () => {
    window.sessionStorage.setItem('df-table:clientes', JSON.stringify({ widths: { id: 80, nombre: 250, estado: 120 } }));
    const f = await renderForm([data({ persistState: true })]);
    expect(colStyles(f)).toEqual(['80px', '250px', '120px']);
  });

  it('unos anchos guardados a los que les falta una columna se descartan', async () => {
    window.sessionStorage.setItem('df-table:clientes', JSON.stringify({ widths: { id: 80, nombre: 250 } }));
    const f = await renderForm([data({ persistState: true })]);
    expect(colStyles(f)).toEqual(['16.7%', '50%', '33.3%']);
  });

  it('con selección y acciones, la casilla y las acciones también entran en los anchos', async () => {
    const f = await renderForm([data({ selectable: 'multiple', actions: [{ name: 'ver', label: 'Ver' }] })]);
    await dragBy(f, handle(2), 10);
    expect(colStyles(f)).toHaveLength(5);
    expect(colStyles(f)).toEqual(['36px', '110px', '100px', '100px', '120px']);
  });
});

describe('Tablas: ordenar por varias columnas', () => {
  const rows = [
    { grupo: 'B', nombre: 'Zoe', importe: 5 },
    { grupo: 'A', nombre: 'Zoe', importe: 9 },
    { grupo: 'B', nombre: 'Ana', importe: 7 },
    { grupo: 'A', nombre: 'Ana', importe: 1 },
    { grupo: 'B', nombre: null, importe: 3 },
  ];
  const cols = [
    { key: 'grupo', label: 'Grupo' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'importe', label: 'Importe', type: 'number' as const },
  ];
  const data = (extra: Partial<DfTable> = {}) => tabla({ id: 'clientes', columns: cols, rows, multiSort: true, ...extra });
  const sort = (n: number) => `.df-table thead tr:first-child th:nth-child(${n}) .df-table__sort`;
  const body = (f: Page) => f.$$('.df-table tbody tr').map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim()).join('/'));
  const clickWith = async (f: { $: (s: string) => HTMLElement | null; stable(): Promise<void> }, selector: string, shiftKey: boolean) => {
    f.$(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey }));
    await f.stable();
  };
  type Harness = Page & { $: (s: string) => HTMLElement | null; stable(): Promise<void> };
  const pos = (f: Harness, n: number) => f.$(`${sort(n)} sup`)?.textContent;
  const aria = (f: Page, n: number) => f.$$(`.df-table thead tr:first-child th`)[n - 1].getAttribute('aria-sort');

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('Mayús + clic añade columnas al orden: la primera manda y las demás desempatan', async () => {
    const f = await renderForm([data()]);
    await clickWith(f, sort(1), false);
    await clickWith(f, sort(3), true);
    expect(body(f)).toEqual(['A/Ana/1', 'A/Zoe/9', 'B//3', 'B/Zoe/5', 'B/Ana/7']);
    expect(pos(f, 1)).toBe('1');
    expect(pos(f, 3)).toBe('2');
    expect(pos(f, 2)).toBeUndefined();
    expect(aria(f, 3)).toBe('ascending');
  });

  it('Mayús + clic sobre una columna del orden cambia su sentido y a la tercera la quita', async () => {
    const f = await renderForm([data()]);
    await clickWith(f, sort(1), false);
    await clickWith(f, sort(3), true);
    await clickWith(f, sort(3), true);
    expect(aria(f, 3)).toBe('descending');
    expect(body(f)[0]).toBe('A/Zoe/9');
    await clickWith(f, sort(3), true);
    expect(aria(f, 3)).toBe('none');
    expect(pos(f, 1)).toBeUndefined();
  });

  it('un clic sin Mayús deja solo esa columna, y la cicla si ya era la única', async () => {
    const f = await renderForm([data()]);
    await clickWith(f, sort(1), false);
    await clickWith(f, sort(3), true);
    await clickWith(f, sort(2), false);
    expect(aria(f, 1)).toBe('none');
    expect(aria(f, 2)).toBe('ascending');
    await clickWith(f, sort(2), false);
    expect(aria(f, 2)).toBe('descending');
    await clickWith(f, sort(2), false);
    expect(aria(f, 2)).toBe('none');
  });

  it('sin multiSort, Mayús + clic se comporta como un clic normal', async () => {
    const f = await renderForm([data({ multiSort: false })]);
    await clickWith(f, sort(1), false);
    await clickWith(f, sort(3), true);
    expect(aria(f, 1)).toBe('none');
    expect(aria(f, 3)).toBe('ascending');
  });

  it('el orden inicial puede ser una lista', async () => {
    const f = await renderForm([data({ sort: [{ key: 'grupo', direction: 'desc' }, { key: 'importe', direction: 'desc' }] })]);
    expect(body(f)).toEqual(['B/Ana/7', 'B/Zoe/5', 'B//3', 'A/Zoe/9', 'A/Ana/1']);
    expect(pos(f, 1)).toBe('1');
    expect(pos(f, 3)).toBe('2');
  });

  it('se recuerda entero con persistState', async () => {
    const f = await renderForm([data({ persistState: true })]);
    await clickWith(f, sort(1), false);
    await clickWith(f, sort(3), true);
    expect(JSON.parse(window.sessionStorage.getItem('df-table:clientes')!).sorts).toEqual([
      { key: 'grupo', direction: 'asc' }, { key: 'importe', direction: 'asc' },
    ]);
  });
});

describe('Tablas: columnas html', () => {
  const rows: Row[] = [
    { nombre: 'Peña', estado: '<span class="df-badge df-badge--ok">Activo</span>', ficha: '<a href="https://example.com/1">Ver ficha</a>' },
    { nombre: 'Zoe', estado: '<span class="df-badge df-badge--error">Baja</span><img src=x onerror="alert(1)"><script>alert(1)</script>', ficha: '<a href="javascript:alert(1)" style="color:red">Mala</a>' },
  ];
  const html = (extra: Partial<DfTable> = {}): DfNode => tabla({
    columns: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'estado', label: 'Estado', html: true, filter: true },
      { key: 'ficha', label: 'Ficha', html: true },
    ],
    rows,
    ...extra,
  });

  it('pinta el HTML de la celda y conserva las clases de la insignia y los enlaces', async () => {
    const f = await renderForm([html()]);
    const badge = f.$('.df-table tbody tr:first-child td:nth-child(2) .df-badge--ok');
    expect(badge?.textContent).toBe('Activo');
    expect(f.$<HTMLAnchorElement>('.df-table tbody tr:first-child td:nth-child(3) a')?.getAttribute('href')).toBe('https://example.com/1');
  });

  it('el sanitizador quita scripts, on*, style y javascript:', async () => {
    const f = await renderForm([html()]);
    const row = f.$<HTMLElement>('.df-table tbody tr:nth-child(2)')!;
    expect(row.querySelector('script')).toBeNull();
    expect(row.querySelector('img[onerror]')).toBeNull();
    const a = row.querySelector('a')!;
    expect(a.getAttribute('style')).toBeNull();
    expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
  });

  it('sin html: true las etiquetas se ven como texto', async () => {
    const f = await renderForm([html({ columns: [{ key: 'estado', label: 'Estado' }] })]);
    expect(f.$('.df-table tbody tr:first-child td')?.textContent).toContain('<span class="df-badge');
    expect(f.$('.df-table tbody .df-badge')).toBeNull();
  });

  it('el filtro de la columna busca en el texto, no en las etiquetas', async () => {
    const f = await renderForm([html()]);
    await f.type('.df-table__filters th:nth-child(2) input', 'badge');
    expect(f.$$('.df-table tbody tr:not(.df-table__empty)')).toHaveLength(0);
  });
});
