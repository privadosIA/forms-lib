import { DfNode, DfTable } from '../../models/schema.model';
import { renderForm } from '../../testing/render-form';

const filas = [
  { nombre: 'Peña', importe: 1500.5, alta: '2024-03-15', activo: true, estado: 'P' },
  { nombre: 'Álvaro', importe: 20, alta: '2023-12-01T10:30:00', activo: false, estado: 'A' },
  { nombre: 'Zoe', importe: 300, alta: '15/01/2025', activo: true, estado: 'X' },
  { nombre: 'Berta', importe: null, alta: null, activo: null, estado: 'A' },
];

const tabla = (extra: Partial<DfTable> = {}): DfNode => ({
  type: 'table',
  id: 'clientes',
  title: 'Clientes',
  columns: [
    { key: 'nombre', label: 'Nombre' },
    { key: 'importe', label: 'Importe', type: 'currency' },
    { key: 'alta', label: 'Alta', type: 'date' },
    { key: 'activo', label: 'Activo', type: 'boolean' },
    { key: 'estado', label: 'Estado', type: 'map', map: { P: 'Pendiente', A: 'Aprobado' } },
  ],
  rows: filas,
  ...extra,
});

describe('TableFieldComponent (df-table)', () => {
  const body = (f: { $$: (s: string) => HTMLElement[] }) =>
    f.$$('.df-table tbody tr:not(.df-table__empty)').map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim()));
  const names = (f: { $$: (s: string) => HTMLElement[] }) => body(f).map((r) => r[0]);

  it('pinta cabecera, título y una fila por registro con cada tipo de columna formateado', async () => {
    const f = await renderForm([tabla()]);
    expect(f.$('.df-table__title')?.textContent).toBe('Clientes');
    expect(f.$$('.df-table thead th').map((th) => th.textContent?.trim())).toEqual(['Nombre', 'Importe', 'Alta', 'Activo', 'Estado']);
    const rows = body(f);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(['Peña', expect.stringMatching(/^1\.500,50\s€$/), '15/03/2024', 'Sí', 'Pendiente']);
    expect(rows[1]).toEqual(['Álvaro', expect.stringMatching(/^20,00\s€$/), '01/12/2023', 'No', 'Aprobado']);
    expect(rows[2][2]).toBe('15/01/2025');
    expect(rows[2][4]).toBe('X'); // sin entrada en el map, se muestra el valor
    expect(rows[3]).toEqual(['Berta', '', '', '', 'Aprobado']);
  });

  it('no escribe nada en el modelo ni crea controles', async () => {
    const f = await renderForm([tabla(), { key: 'nota', type: 'text' }]);
    await f.type('input[type=text]', 'hola');
    await f.submit();
    expect(f.host.submitted[0].model).toEqual({ nota: 'hola' });
  });

  it('ordena al pulsar la cabecera: ascendente, descendente y sin orden; los vacíos van siempre al final', async () => {
    const f = await renderForm([tabla()]);
    const th = (i: number) => f.$$<HTMLElement>('.df-table thead th')[i];
    await f.click('.df-table thead th:nth-child(1) button');
    expect(names(f)).toEqual(['Álvaro', 'Berta', 'Peña', 'Zoe']);
    expect(th(0).getAttribute('aria-sort')).toBe('ascending');
    await f.click('.df-table thead th:nth-child(1) button');
    expect(names(f)).toEqual(['Zoe', 'Peña', 'Berta', 'Álvaro']);
    await f.click('.df-table thead th:nth-child(1) button');
    expect(names(f)).toEqual(['Peña', 'Álvaro', 'Zoe', 'Berta']);
    expect(th(0).getAttribute('aria-sort')).toBe('none');

    await f.click('.df-table thead th:nth-child(2) button');
    expect(names(f)).toEqual(['Álvaro', 'Zoe', 'Peña', 'Berta']);
    await f.click('.df-table thead th:nth-child(2) button');
    expect(names(f)).toEqual(['Peña', 'Zoe', 'Álvaro', 'Berta']);
  });

  it('ordena las fechas por fecha real (mezclando formatos) y no por texto', async () => {
    const f = await renderForm([tabla()]);
    await f.click('.df-table thead th:nth-child(3) button');
    expect(names(f)).toEqual(['Álvaro', 'Peña', 'Zoe', 'Berta']);
  });

  it('una columna con sortable false no tiene botón de orden', async () => {
    const f = await renderForm([tabla({ columns: [{ key: 'nombre', label: 'Nombre', sortable: false }, { key: 'alta', label: 'Alta' }] })]);
    expect(f.$('.df-table thead th:nth-child(1) button')).toBeNull();
    expect(f.$('.df-table thead th:nth-child(2) button')).not.toBeNull();
  });

  it('respeta el orden inicial del esquema', async () => {
    const f = await renderForm([tabla({ sort: { key: 'nombre', direction: 'desc' } })]);
    expect(names(f)).toEqual(['Zoe', 'Peña', 'Berta', 'Álvaro']);
  });

  it('filtra por el texto que se ve, sin distinguir mayúsculas ni acentos', async () => {
    const f = await renderForm([tabla({ filter: true })]);
    await f.type('.df-table__search', 'pena');
    expect(names(f)).toEqual(['Peña']);
    await f.type('.df-table__search', 'aprobado');
    expect(names(f)).toEqual(['Álvaro', 'Berta']);
    await f.type('.df-table__search', '1.500');
    expect(names(f)).toEqual(['Peña']);
    await f.type('.df-table__search', 'nada que ver');
    expect(f.$('.df-table__empty')?.textContent).toContain('Ningún resultado');
    expect(f.$('.df-table__search')).not.toBeNull();
  });

  it('searchKeys amplía la búsqueda a claves de la fila que no son columnas', async () => {
    const rows = [
      { nombre: 'Peña', ref: { codigo: 'ZX-9' } },
      { nombre: 'Berta', ref: { codigo: 'QQ-1' } },
    ];
    const f = await renderForm([tabla({ rows, columns: [{ key: 'nombre', label: 'Nombre' }], filter: true, searchKeys: ['ref.codigo'] })]);
    await f.type('.df-table__search', 'zx-9');
    expect(names(f)).toEqual(['Peña']);
  });

  it('sin searchKeys no busca en claves que no son columnas', async () => {
    const rows = [{ nombre: 'Peña', ref: { codigo: 'ZX-9' } }];
    const f = await renderForm([tabla({ rows, columns: [{ key: 'nombre', label: 'Nombre' }], filter: true })]);
    await f.type('.df-table__search', 'zx-9');
    expect(names(f)).toEqual([]);
  });

  it('sin filter no hay cuadro de búsqueda', async () => {
    const f = await renderForm([tabla()]);
    expect(f.$('.df-table__search')).toBeNull();
  });

  it('pagina: rango, botones, tamaño de página y vuelta a la primera al filtrar u ordenar', async () => {
    const muchas = Array.from({ length: 12 }, (_, i) => ({ nombre: `Fila ${String(i + 1).padStart(2, '0')}`, importe: i }));
    const f = await renderForm([tabla({ rows: muchas, pageSize: 5, pageSizeOptions: [5, 10], filter: true })]);
    expect(names(f)).toHaveLength(5);
    expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 12');
    const [prev, next] = f.$$<HTMLButtonElement>('.df-table__page');
    expect(prev.disabled).toBe(true);

    await f.click('.df-table__page:last-child');
    expect(f.$('.df-table__range')?.textContent).toBe('6–10 de 12');
    await f.click('.df-table__page:last-child');
    expect(f.$('.df-table__range')?.textContent).toBe('11–12 de 12');
    expect(names(f)).toEqual(['Fila 11', 'Fila 12']);
    expect(next.disabled).toBe(true);

    await f.type('.df-table__search', 'fila 0');
    expect(f.$('.df-table__range')?.textContent).toBe('1–5 de 9');

    await f.choose('.df-table__page-size select', '10');
    expect(f.$('.df-table__range')?.textContent).toBe('1–9 de 9');
  });

  it('sin pageSize no hay paginación', async () => {
    const f = await renderForm([tabla()]);
    expect(f.$('.df-table__pager')).toBeNull();
  });

  it('sin filas muestra el mensaje de vacío', async () => {
    const f = await renderForm([tabla({ rows: [] })]);
    expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('No hay datos');
  });

  it('el mensaje de vacío se puede personalizar', async () => {
    const f = await renderForm([tabla({ rows: [], emptyMessage: 'Sin clientes' })]);
    expect(f.$('.df-table__empty')?.textContent?.trim()).toBe('Sin clientes');
  });

  it('dataKey lee las filas del modelo y se actualiza cuando el modelo cambia', async () => {
    const f = await renderForm([tabla({ rows: undefined, dataKey: 'datos.clientes' })], { model: { datos: { clientes: [filas[0]] } } });
    expect(names(f)).toEqual(['Peña']);
    f.host.model = { datos: { clientes: [filas[0], filas[2]] } };
    f.fixture.changeDetectorRef.markForCheck();
    await f.stable();
    expect(names(f)).toEqual(['Peña', 'Zoe']);
    f.host.model = {};
    f.fixture.changeDetectorRef.markForCheck();
    await f.stable();
    expect(f.$('.df-table__empty')).not.toBeNull();
  });

  it('las acciones emiten tableAction con la fila, y el clic no selecciona', async () => {
    const f = await renderForm([tabla({ actions: [{ name: 'editar', label: 'Editar' }, { name: 'borrar', label: 'Borrar' }] })]);
    const events: unknown[] = [];
    f.host.dynamicForm.tableAction.subscribe((e) => events.push(e));
    f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e));
    expect(f.$$('.df-table__action')).toHaveLength(8);
    await f.click('tbody tr:nth-child(2) .df-table__action:nth-child(2)');
    expect(events).toEqual([{ tableId: 'clientes', action: 'borrar', row: expect.objectContaining({ nombre: 'Álvaro' }) }]);
  });

  describe('acciones con icono y condiciones', () => {
    const acciones = [
      { name: 'ver', label: 'Ver', icon: 'view', tooltip: 'Abrir ficha' },
      { name: 'borrar', label: 'Borrar', icon: '🗑', showWhen: { field: './estado', operator: 'eq', value: 'A' } },
      { name: 'editar', label: 'Editar', disabledWhen: { field: './activo', operator: 'eq', value: false } },
    ] as DfTable['actions'];

    it('pinta el icono incluido como SVG y otro texto tal cual, con nombre accesible y tooltip', async () => {
      const f = await renderForm([tabla({ actions: acciones })]);
      const ver = f.$('tbody tr:nth-child(1) .df-table__action')!;
      expect(ver.querySelector('svg')).not.toBeNull();
      expect(ver.getAttribute('aria-label')).toBe('Ver');
      expect(ver.getAttribute('title')).toBe('Abrir ficha');
      expect(ver.textContent?.trim()).toBe('');
    });

    it('showWhen oculta la acción en las filas que no cumplen la regla', async () => {
      const f = await renderForm([tabla({ actions: acciones })]);
      const nombres = (n: number) => f.$$(`tbody tr:nth-child(${n}) .df-table__action`).map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
      expect(nombres(1)).toEqual(['Ver', 'Editar']); // estado P
      expect(nombres(2)).toEqual(['Ver', 'Borrar', 'Editar']); // estado A
      const borrar = f.$('tbody tr:nth-child(2) .df-table__action:nth-child(2)')!;
      expect(borrar.textContent?.trim()).toBe('🗑');
    });

    it('disabledWhen deshabilita el botón y no emite tableAction', async () => {
      const f = await renderForm([tabla({ actions: acciones })]);
      const events: unknown[] = [];
      f.host.dynamicForm.tableAction.subscribe((e) => events.push(e));
      const editar = (n: number) => f.$<HTMLButtonElement>(`tbody tr:nth-child(${n}) .df-table__action:last-child`)!;
      expect(editar(2).disabled).toBe(true); // activo false
      expect(editar(1).disabled).toBe(false);
      await f.click('tbody tr:nth-child(2) .df-table__action:last-child');
      expect(events).toEqual([]);
      await f.click('tbody tr:nth-child(1) .df-table__action:last-child');
      expect(events).toHaveLength(1);
    });
  });

  describe('plantillas de la app (dfCell y dfEmpty)', () => {
    it('una columna con template pinta la plantilla dfCell con la fila y el valor', async () => {
      const f = await renderForm([tabla({
        columns: [{ key: 'nombre', label: 'Nombre' }, { key: 'estado', label: 'Estado', template: 'estado' }],
      })]);
      const cells = f.$$('tbody td .slot-estado');
      expect(cells.map((c) => c.textContent)).toEqual(['P!', 'A!', 'X!', 'A!']);
      expect(cells[1].getAttribute('data-nombre')).toBe('Álvaro');
    });

    it('con una plantilla que no existe se pinta el texto de la celda', async () => {
      const f = await renderForm([tabla({ columns: [{ key: 'estado', label: 'Estado', template: 'noexiste', type: 'map', map: { P: 'Pendiente' } }] })]);
      expect(f.$$('tbody tr')[0].textContent?.trim()).toBe('Pendiente');
    });

    it('el filtro y la ordenación siguen usando el valor, no la plantilla', async () => {
      const f = await renderForm([tabla({
        filter: true,
        columns: [{ key: 'nombre', label: 'Nombre' }, { key: 'estado', label: 'Estado', template: 'estado' }],
      })]);
      await f.type('.df-table__search', 'zoe');
      expect(f.$$('tbody tr:not(.df-table__empty)')).toHaveLength(1);
    });

    it('dfEmpty sustituye al emptyMessage de esa tabla, con su id como contexto', async () => {
      const f = await renderForm([
        tabla({ id: 'sinfilas', rows: [], emptyMessage: 'texto' }),
        tabla({ id: 'otra', rows: [], emptyMessage: 'Vacía a secas' }),
      ]);
      expect(f.$$('.df-table__empty')[0].textContent?.trim()).toBe('Sin filas en sinfilas');
      expect(f.$$('.df-table__empty')[1].textContent?.trim()).toBe('Vacía a secas');
    });

    it('con un filtro sin resultados se sigue viendo el texto, no la plantilla vacía', async () => {
      const f = await renderForm([tabla({ id: 'sinfilas', filter: true })]);
      await f.type('.df-table__search', 'nada que ver');
      expect(f.$('.df-table__empty')?.textContent).toContain('Ningún resultado');
      expect(f.$('.slot-empty')).toBeNull();
    });
  });

  describe('celdas badge y link', () => {
    const rows = [
      { id: 7, nombre: 'Peña', estado: 'OK' },
      { id: 'a/b', nombre: 'Berta', estado: 'KO' },
      { id: null, nombre: 'Zoe', estado: 'ZZ' },
    ];
    const columns: DfTable['columns'] = [
      { key: 'nombre', label: 'Nombre', type: 'link', href: '/personas/{id}' },
      { key: 'estado', label: 'Estado', type: 'badge', map: { OK: 'Correcto', KO: 'Fallido' }, variants: { OK: 'ok', KO: 'error' }, filter: true },
    ];

    it('badge pinta la insignia con su variante y el texto del map; sin variante, la neutra', async () => {
      const f = await renderForm([tabla({ rows, columns })]);
      const badges = f.$$('tbody td[data-type=badge] .df-badge');
      expect(badges.map((b) => [b.className, b.textContent])).toEqual([
        ['df-badge df-badge--ok', 'Correcto'], ['df-badge df-badge--error', 'Fallido'], ['df-badge', 'ZZ'],
      ]);
    });

    it('badge se filtra con un desplegable de sus textos', async () => {
      const f = await renderForm([tabla({ rows, columns })]);
      const options = f.$$('select.df-table__column-filter option').map((o) => o.textContent?.trim());
      expect(options).toEqual(['Todos', 'Correcto', 'Fallido']);
    });

    it('link pinta el enlace con los valores de la fila codificados, y sin enlace si falta alguno', async () => {
      const f = await renderForm([tabla({ rows, columns })]);
      expect(f.$$('tbody td[data-type=link] a').map((a) => a.getAttribute('href'))).toEqual(['/personas/7', '/personas/a%2Fb']);
      expect(f.$$('tbody td[data-type=link]')[2].textContent?.trim()).toBe('Zoe');
      expect(f.$$('tbody td[data-type=link]')[2].querySelector('a')).toBeNull();
    });

    it('un clic en el enlace emite tableNavigate con el destino y deja a la app cancelar la navegación', async () => {
      const f = await renderForm([tabla({ rows, columns, selectable: true })]);
      const events: { href: string; column: string; row: { nombre: string }; originalEvent: MouseEvent }[] = [];
      f.host.dynamicForm.tableNavigate.subscribe((e) => { e.originalEvent.preventDefault(); events.push(e as never); });
      const selects: unknown[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => selects.push(e));
      const a = f.$<HTMLAnchorElement>('tbody td[data-type=link] a')!;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      a.dispatchEvent(click);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(expect.objectContaining({ href: '/personas/7', column: 'nombre' }));
      expect(events[0].row.nombre).toBe('Peña');
      expect(click.defaultPrevented).toBe(true);
      expect(selects).toEqual([]); // el clic en el enlace no selecciona la fila
    });

    it('con Ctrl o Cmd no emite: el navegador abre otra pestaña', async () => {
      const f = await renderForm([tabla({ rows, columns })]);
      const events: unknown[] = [];
      f.host.dynamicForm.tableNavigate.subscribe((e) => events.push(e));
      const a = f.$<HTMLAnchorElement>('tbody td[data-type=link] a')!;
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
      expect(events).toEqual([]);
    });
  });

  describe('tableSelect.changed', () => {
    const muchas = Array.from({ length: 5 }, (_, i) => ({ nombre: `N${i + 1}` }));
    interface Ev {
      row: { nombre: string } | null;
      rows: { nombre: string }[];
      changed: { rows: { nombre: string }[]; selected: boolean };
    }
    const names = (rows: { nombre: string }[]) => rows.map((r) => r.nombre);

    it('selección múltiple: marcar y desmarcar una fila dice cuál y en qué sentido, y row sigue siendo null', async () => {
      const f = await renderForm([tabla({ rows: muchas, selectable: 'multiple' })]);
      const events: Ev[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      await f.click('tbody tr:nth-child(2)');
      await f.click('tbody tr:nth-child(4)');
      await f.click('tbody tr:nth-child(2)');
      expect(events.map((e) => [names(e.changed.rows), e.changed.selected, names(e.rows), e.row])).toEqual([
        [['N2'], true, ['N2'], null],
        [['N4'], true, ['N2', 'N4'], null],
        [['N2'], false, ['N4'], null],
      ]);
    });

    it('la casilla de la cabecera lista solo las filas que cambian de estado', async () => {
      const f = await renderForm([tabla({ rows: muchas, selectable: 'multiple' })]);
      const events: Ev[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      await f.click('tbody tr:nth-child(1)');
      await f.click('thead th.df-table__check input');
      expect(names(events[1].changed.rows)).toEqual(['N2', 'N3', 'N4', 'N5']);
      expect(events[1].changed.selected).toBe(true);
      await f.click('thead th.df-table__check input');
      expect(names(events[2].changed.rows)).toEqual(['N1', 'N2', 'N3', 'N4', 'N5']);
      expect(events[2].changed.selected).toBe(false);
    });

    it('Mayús + clic lista las filas añadidas del rango', async () => {
      const f = await renderForm([tabla({ rows: muchas, selectable: 'multiple' })]);
      const events: Ev[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      await f.click('tbody tr:nth-child(1)');
      f.$('tbody tr:nth-child(4)')!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
      await f.stable();
      expect(names(events[1].changed.rows)).toEqual(['N2', 'N3', 'N4']);
      expect(events[1].changed.selected).toBe(true);
      expect(names(events[1].rows)).toEqual(['N1', 'N2', 'N3', 'N4']);
    });

    it('selección única: la fila elegida es la marcada, y al deseleccionar, la que se suelta', async () => {
      const f = await renderForm([tabla({ rows: muchas, selectable: true })]);
      const events: Ev[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      await f.click('tbody tr:nth-child(1)');
      await f.click('tbody tr:nth-child(3)');
      await f.click('tbody tr:nth-child(3)');
      expect(events.map((e) => [names(e.changed.rows), e.changed.selected, e.row?.nombre ?? null])).toEqual([
        [['N1'], true, 'N1'], [['N3'], true, 'N3'], [['N3'], false, null],
      ]);
    });
  });

  describe('selección condicional', () => {
    const muchas = Array.from({ length: 6 }, (_, i) => ({ nombre: `N${i + 1}`, estado: i % 2 === 0 ? 'FIN' : 'RUN' }));
    const solo = { field: './estado', operator: 'eq', value: 'FIN' } as const;
    const base = { rows: muchas, selectable: 'multiple', selectableWhen: solo } as const;

    it('las filas que no cumplen la regla tienen la casilla desactivada y no responden al clic', async () => {
      const f = await renderForm([tabla({ ...base })]);
      const events: { rows: { nombre: string }[] }[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      const checks = f.$$<HTMLInputElement>('tbody td.df-table__check input');
      expect(checks.map((c) => c.disabled)).toEqual([false, true, false, true, false, true]);
      await f.click('tbody tr:nth-child(2)'); // RUN: no se selecciona
      expect(events).toEqual([]);
      await f.click('tbody tr:nth-child(1)');
      expect(events.at(-1)?.rows.map((r) => r.nombre)).toEqual(['N1']);
    });

    it('la casilla de la cabecera marca solo las seleccionables', async () => {
      const f = await renderForm([tabla({ ...base })]);
      const events: { rows: { nombre: string }[] }[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      await f.click('thead th.df-table__check input');
      expect(events.at(-1)?.rows.map((r) => r.nombre)).toEqual(['N1', 'N3', 'N5']);
      expect(f.$<HTMLInputElement>('thead th.df-table__check input')!.checked).toBe(true);
    });

    it('con selectable simple tampoco se elige una fila que no cumple la regla', async () => {
      const f = await renderForm([tabla({ rows: muchas, selectable: true, selectableWhen: solo })]);
      await f.click('tbody tr:nth-child(2)');
      expect(f.$$('tr.is-selected')).toHaveLength(0);
      await f.click('tbody tr:nth-child(3)');
      expect(f.$$('tr.is-selected')).toHaveLength(1);
    });

    it("headerSelects: 'page' marca solo las filas de la página visible", async () => {
      const f = await renderForm([tabla({ rows: muchas, selectable: 'multiple', pageSize: 2, pageSizeOptions: [2, 4], headerSelects: 'page' })]);
      const events: { rows: { nombre: string }[] }[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      await f.click('thead th.df-table__check input');
      expect(events.at(-1)?.rows.map((r) => r.nombre)).toEqual(['N1', 'N2']);
    });

    it("sin headerSelects la cabecera marca todo lo filtrado, aunque haya varias páginas", async () => {
      const f = await renderForm([tabla({ rows: muchas, selectable: 'multiple', pageSize: 2, pageSizeOptions: [2, 4] })]);
      const events: { rows: unknown[] }[] = [];
      f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
      await f.click('thead th.df-table__check input');
      expect(events.at(-1)?.rows).toHaveLength(6);
    });
  });

  it('selectable: un clic selecciona una fila, otro la deselecciona y emite tableSelect', async () => {
    const f = await renderForm([tabla({ selectable: true })]);
    const events: { row: { nombre: string } | null }[] = [];
    f.host.dynamicForm.tableSelect.subscribe((e) => events.push(e as never));
    await f.click('tbody tr:nth-child(1)');
    await f.click('tbody tr:nth-child(3)');
    expect(f.$$('tr.is-selected')).toHaveLength(1);
    expect(f.$('tr.is-selected td')?.textContent).toBe('Zoe');
    await f.click('tbody tr:nth-child(3)');
    expect(f.$$('tr.is-selected')).toHaveLength(0);
    expect(events.map((e) => e.row?.nombre ?? null)).toEqual(['Peña', 'Zoe', null]);
  });

  it('una tabla no selectable no marca filas ni emite', async () => {
    const f = await renderForm([tabla()]);
    await f.click('tbody tr:nth-child(1)');
    expect(f.$$('tr.is-selected')).toHaveLength(0);
  });

  it('una regla de lógica puede ocultar la tabla', async () => {
    const f = await renderForm(
      [{ key: 'ver', type: 'checkbox' }, tabla({ logic: { showWhen: { field: 'ver', operator: 'truthy' } } })],
    );
    expect(f.$('.df-table')).toBeNull();
    await f.click('input[type=checkbox]');
    expect(f.$('.df-table')).not.toBeNull();
  });

  it('escapa el contenido: un texto con HTML no se interpreta', async () => {
    const f = await renderForm([tabla({ rows: [{ nombre: '<img src=x onerror=alert(1)>' }], columns: [{ key: 'nombre', label: 'Nombre' }] })]);
    expect(f.$('.df-table tbody img')).toBeNull();
    expect(f.$('.df-table tbody td')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
