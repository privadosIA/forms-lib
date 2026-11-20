import { Observable, Subject, of, throwError } from 'rxjs';
import { DfTablePage, DfTableProvider, DfTableRequest } from '../../models/config.model';
import { DfNode, DfTable } from '../../models/schema.model';
import { renderForm } from '../../testing/render-form';

type Row = Record<string, unknown>;
type Result = DfTablePage | Row[];

/** Servicio falso: guarda las llamadas y responde lo que diga `handler`. */
class FakeTableProvider implements DfTableProvider {
  static calls: { endpoint: string; request: DfTableRequest }[] = [];
  static handler: (endpoint: string, request: DfTableRequest) => Observable<Result> = () => of([]);
  load(endpoint: string, request: DfTableRequest): Observable<Result> {
    FakeTableProvider.calls.push({ endpoint, request });
    return FakeTableProvider.handler(endpoint, request);
  }
}

const DATA: Row[] = Array.from({ length: 23 }, (_, i) => ({
  n: `Fila ${String(i + 1).padStart(2, '0')}`,
  estado: i % 2 === 0 ? 'A' : 'B',
  importe: (i + 1) * 10,
}));

/** Lo que haría un backend paginado: filtra, ordena y recorta. */
function serverSide(_e: string, r: DfTableRequest): Observable<DfTablePage> {
  let rows = DATA.filter((d) => (!r.filter || String(d['n']).toLowerCase().includes(r.filter.toLowerCase()))
    && (!r.params['estado'] || d['estado'] === r.params['estado']));
  if (r.sort) {
    const { key, direction } = r.sort;
    const value = (row: Row) => row[key] as number | string;
    rows = [...rows].sort((a, b) => (Number(value(a) > value(b)) - Number(value(a) < value(b))) * (direction === 'asc' ? 1 : -1));
  }
  const size = r.pageSize ?? rows.length;
  return of({ rows: rows.slice(r.page * size, r.page * size + size), total: rows.length });
}

const tabla = (extra: Partial<DfTable> = {}): DfNode => ({
  type: 'table',
  id: 'datos',
  columns: [{ key: 'n', label: 'Nombre' }, { key: 'importe', label: 'Importe', type: 'number' }],
  source: { endpoint: '/api/datos' },
  ...extra,
});

const config = { tableProvider: FakeTableProvider };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const names = (f: { $$: (s: string) => HTMLElement[] }) =>
  f.$$('.df-table tbody tr:not(.df-table__empty)').map((tr) => tr.querySelector('td')?.textContent?.trim());

describe('TableFieldComponent con source (servicio)', () => {
  beforeEach(() => {
    FakeTableProvider.calls = [];
    FakeTableProvider.handler = () => of(DATA);
  });

  describe('modo client: el servicio devuelve todo', () => {
    it('pide todas las filas una vez y filtra, ordena y pagina sin volver a llamar', async () => {
      const f = await renderForm([tabla({ filter: true, pageSize: 5 })], { config });
      expect(FakeTableProvider.calls).toEqual([{
        endpoint: '/api/datos',
        request: { page: 0, pageSize: null, sort: null, sorts: [], filter: '', columnFilters: {}, params: {} },
      }]);
      expect(names(f)).toHaveLength(5);
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 23');

      await f.click('.df-table__page:last-child');
      expect(f.$('.df-table__range')?.textContent).toBe('6–10 de 23');
      await f.click('.df-table thead th:nth-child(2) button');
      await f.click('.df-table thead th:nth-child(2) button');
      expect(names(f)[0]).toBe('Fila 23');
      await f.type('.df-table__search', 'fila 1');
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 10');
      expect(FakeTableProvider.calls).toHaveLength(1);
    });

    it('acepta que el servicio devuelva { rows, total }', async () => {
      FakeTableProvider.handler = () => of({ rows: DATA.slice(0, 3), total: 3 });
      const f = await renderForm([tabla()], { config });
      expect(names(f)).toEqual(['Fila 01', 'Fila 02', 'Fila 03']);
    });
  });

  describe('modo server: el servicio devuelve una página cada vez', () => {
    beforeEach(() => {
      FakeTableProvider.handler = serverSide;
    });
    const servidor = (extra: Partial<DfTable> = {}) =>
      tabla({ source: { endpoint: '/api/datos', mode: 'server' }, pageSize: 5, filter: true, ...extra });

    it('pide la primera página con el orden inicial y muestra el total del servidor', async () => {
      const f = await renderForm([servidor({ sort: { key: 'importe', direction: 'desc' } })], { config });
      expect(FakeTableProvider.calls).toHaveLength(1);
      expect(FakeTableProvider.calls[0].request).toEqual({
        page: 0, pageSize: 5, sort: { key: 'importe', direction: 'desc' }, sorts: [{ key: 'importe', direction: 'desc' }], filter: '', columnFilters: {}, params: {},
      });
      expect(names(f)).toEqual(['Fila 23', 'Fila 22', 'Fila 21', 'Fila 20', 'Fila 19']);
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 23');
    });

    it('cada cambio de página, orden o tamaño es una petición nueva y se queda con lo que devuelve el servicio', async () => {
      const f = await renderForm([servidor()], { config });
      const last = () => FakeTableProvider.calls[FakeTableProvider.calls.length - 1].request;

      await f.click('.df-table__page:last-child');
      expect(last()).toMatchObject({ page: 1, pageSize: 5 });
      expect(names(f)[0]).toBe('Fila 06');
      expect(f.$('.df-table__range')?.textContent).toBe('6–10 de 23');

      await f.click('.df-table thead th:nth-child(2) button');
      expect(last()).toMatchObject({ page: 0, sort: { key: 'importe', direction: 'asc' } });
      await f.click('.df-table thead th:nth-child(2) button');
      expect(last()).toMatchObject({ sort: { key: 'importe', direction: 'desc' } });
      expect(names(f)[0]).toBe('Fila 23');
      await f.click('.df-table thead th:nth-child(2) button');
      expect(last().sort).toBeNull();

      await f.choose('.df-table__page-size select', '10');
      expect(last()).toMatchObject({ page: 0, pageSize: 10 });
      expect(names(f)).toHaveLength(10);

      await f.click('.df-table__page:last-child');
      await f.click('.df-table__page:last-child');
      expect(f.$('.df-table__range')?.textContent).toBe('21–23 de 23');
      expect(FakeTableProvider.calls).toHaveLength(8);
    });

    it('no reordena en el cliente: muestra las filas en el orden en que llegan', async () => {
      FakeTableProvider.handler = () => of({ rows: [DATA[2], DATA[0], DATA[1]], total: 3 });
      const f = await renderForm([servidor({ sort: { key: 'n' } })], { config });
      expect(names(f)).toEqual(['Fila 03', 'Fila 01', 'Fila 02']);
    });

    it('el filtro espera a que se deje de escribir y entonces pide la página 0', async () => {
      const f = await renderForm([servidor()], { config });
      await f.click('.df-table__page:last-child');
      const before = FakeTableProvider.calls.length;
      await f.type('.df-table__search', 'fi', false);
      await f.type('.df-table__search', 'fila 2', false);
      expect(FakeTableProvider.calls).toHaveLength(before);
      await wait(380);
      await f.stable();
      expect(FakeTableProvider.calls).toHaveLength(before + 1);
      expect(FakeTableProvider.calls[before].request).toMatchObject({ page: 0, filter: 'fila 2' });
      expect(names(f)).toEqual(['Fila 20', 'Fila 21', 'Fila 22', 'Fila 23']);
      expect(f.$('.df-table__range')?.textContent).toBe('1–4 de 4');
    });

    it('un array como respuesta cuenta como todo el total', async () => {
      FakeTableProvider.handler = () => of(DATA.slice(0, 2));
      const f = await renderForm([servidor()], { config });
      expect(f.$('.df-table__range')?.textContent).toBe('1–2 de 2');
    });
  });

  describe('parámetros desde el formulario (dependsOn)', () => {
    beforeEach(() => {
      FakeTableProvider.handler = serverSide;
    });
    const dependiente = (): DfNode[] => [
      { key: 'estado', type: 'select', label: 'Estado', options: [{ value: 'A', label: 'Alta' }, { value: 'B', label: 'Baja' }] },
      tabla({ source: { endpoint: '/api/datos', mode: 'server', dependsOn: ['estado'] }, pageSize: 5 }),
    ];

    it('no pide nada hasta que los campos de los que depende tienen valor, y mientras tanto muestra el mensaje de vacío', async () => {
      const f = await renderForm(dependiente(), { config });
      expect(FakeTableProvider.calls).toHaveLength(0);
      expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('No hay datos');
    });

    it('con requireParams: false carga aunque los parámetros estén vacíos', async () => {
      const f = await renderForm([
        { key: 'estado', type: 'text', label: 'Estado' },
        tabla({ source: { endpoint: '/api/datos', mode: 'server', dependsOn: ['estado'], requireParams: false }, pageSize: 5 }),
      ], { config, model: { estado: '' } });
      expect(FakeTableProvider.calls).toHaveLength(1);
      expect(FakeTableProvider.calls[0].request.params).toEqual({ estado: '' });
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 23');
    });

    it('con externalParams lee dependsOn del modelo aunque no sea un campo del esquema', async () => {
      const f = await renderForm([
        tabla({ source: { endpoint: '/api/datos', mode: 'server', dependsOn: ['estado'], externalParams: true }, pageSize: 5 }),
      ], { config, model: { estado: 'A' } });
      expect(FakeTableProvider.calls).toHaveLength(1);
      expect(FakeTableProvider.calls[0].request.params).toEqual({ estado: 'A' });
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 12');
    });

    it('con externalParams recarga cuando la app sustituye el modelo entero (botón «Buscar»)', async () => {
      const f = await renderForm([
        tabla({ source: { endpoint: '/api/datos', mode: 'server', dependsOn: ['estado'], externalParams: true }, pageSize: 5 }),
      ], { config, model: { estado: 'A' } });
      expect(FakeTableProvider.calls).toHaveLength(1);

      f.host.model = { estado: 'B' };
      f.fixture.changeDetectorRef.markForCheck();
      await f.stable();
      expect(FakeTableProvider.calls).toHaveLength(2);
      expect(FakeTableProvider.calls[1].request.params).toEqual({ estado: 'B' });
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 11');
    });

    it('envía los valores como params y recarga desde la primera página cuando cambian', async () => {
      const f = await renderForm(dependiente(), { config, model: { estado: 'A' } });
      expect(FakeTableProvider.calls).toHaveLength(1);
      expect(FakeTableProvider.calls[0].request.params).toEqual({ estado: 'A' });
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 12');

      await f.click('.df-table__page:last-child');
      expect(FakeTableProvider.calls[1].request.page).toBe(1);

      await f.choose('select', 'Baja');
      const last = FakeTableProvider.calls[FakeTableProvider.calls.length - 1].request;
      expect(last).toMatchObject({ page: 0, params: { estado: 'B' } });
      expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 11');
    });

    it('al vaciar el campo se limpia la tabla', async () => {
      const f = await renderForm(dependiente(), { config, model: { estado: 'A' } });
      expect(names(f)).toHaveLength(5);
      f.host.model = {};
      f.fixture.changeDetectorRef.markForCheck();
      await f.stable();
      expect(names(f)).toHaveLength(0);
      expect(f.$('.df-table__empty')).not.toBeNull();
    });
  });

  describe('estados', () => {
    it('mientras carga muestra «Cargando…» y marca la tabla como ocupada', async () => {
      const respuesta = new Subject<Result>();
      FakeTableProvider.handler = () => respuesta;
      const f = await renderForm([tabla()], { config });
      expect(f.$('.df-table__status')?.textContent).toBe('Cargando…');
      expect(f.$('.df-table__scroll')?.getAttribute('aria-busy')).toBe('true');
      expect(f.$('.df-table__empty')).toBeNull();

      respuesta.next(DATA.slice(0, 2));
      await f.stable();
      expect(f.$('.df-table__status')).toBeNull();
      expect(f.$('.df-table__scroll')?.getAttribute('aria-busy')).toBe('false');
      expect(names(f)).toHaveLength(2);
    });

    it('si el servicio falla muestra el error y «Reintentar» vuelve a pedirlo', async () => {
      FakeTableProvider.handler = () => throwError(() => new Error('500'));
      const f = await renderForm([tabla({ errorMessage: 'Fallo del servicio' })], { config });
      expect(f.$('.df-table__empty')?.textContent).toContain('Fallo del servicio');

      FakeTableProvider.handler = () => of(DATA.slice(0, 2));
      await f.click('.df-table__retry');
      expect(FakeTableProvider.calls).toHaveLength(2);
      expect(f.$('.df-table__retry')).toBeNull();
      expect(names(f)).toHaveLength(2);
    });

    it('el mensaje de error por defecto está en español', async () => {
      FakeTableProvider.handler = () => throwError(() => new Error('x'));
      const f = await renderForm([tabla()], { config });
      expect(f.$('.df-table__empty')?.textContent).toContain('No se pudieron cargar los datos');
    });

    it('descarta la respuesta de una petición anterior si ya hay otra más nueva', async () => {
      const lenta = new Subject<Result>();
      const rapida = new Subject<Result>();
      const queue = [lenta, rapida];
      FakeTableProvider.handler = () => queue.shift()!;
      const f = await renderForm([tabla({ source: { endpoint: '/api/datos', mode: 'server' }, pageSize: 5 })], { config });
      await f.click('.df-table thead th:nth-child(1) button');
      rapida.next({ rows: [DATA[1]], total: 1 });
      await f.stable();
      lenta.next({ rows: [DATA[0]], total: 1 });
      await f.stable();
      expect(names(f)).toEqual(['Fila 02']);
    });

    it('sin DF_TABLE_PROVIDER avisa por consola y muestra el error', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const f = await renderForm([tabla()]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('DF_TABLE_PROVIDER'));
      expect(f.$('.df-table__empty')?.textContent).toContain('No se pudieron cargar los datos');
      warn.mockRestore();
    });

    it('al recargar se deselecciona la fila elegida', async () => {
      FakeTableProvider.handler = serverSide;
      const f = await renderForm(
        [tabla({ source: { endpoint: '/api/datos', mode: 'server' }, pageSize: 5, selectable: true })],
        { config },
      );
      const events: (unknown | null)[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e.row ? 'fila' : null));
      await f.click('tbody tr:nth-child(1)');
      expect(f.$$('tr.is-selected')).toHaveLength(1);
      await f.click('.df-table__page:last-child');
      expect(f.$$('tr.is-selected')).toHaveLength(0);
      await wait(0);
      expect(events).toEqual(['fila', null]);
    });
  });
});
