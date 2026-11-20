import { TestBed } from '@angular/core/testing';
import { DfValidatorDefinition } from '../models/config.model';
import { provideDynamicForms } from '../providers/provide-dynamic-forms';
import { DF_VALIDATORS } from '../tokens/dynamic-forms.tokens';
import { SchemaValidatorService } from './schema-validator.service';

const validDef: DfValidatorDefinition = { name: 'dni', message: 'x', validate: () => true };

/** Esquema mínimo válido; cada test lo extiende. */
const schema = (fields: unknown[], extra: Record<string, unknown> = {}) => ({ version: '1.0', id: 'alta', fields, ...extra });

describe('SchemaValidatorService', () => {
  let service: SchemaValidatorService;
  const paths = (s: unknown) => service.validate(s).errors.map((e) => e.path);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DF_VALIDATORS, multi: true, useValue: [validDef] }],
    });
    service = TestBed.inject(SchemaValidatorService);
  });

  it('acepta un esquema válido completo', () => {
    const result = service.validate(
      schema([
        { key: 'tipo', type: 'select', options: [{ value: 'p', label: 'Particular' }] },
        { key: 'provincia', type: 'select', options: { source: 'static', items: [] } },
        { key: 'municipio', type: 'select', options: { source: 'dependent', dependsOn: 'provincia', map: {} } },
        { key: 'calle', type: 'select', options: { source: 'remote', endpoint: '/calles', dependsOn: ['municipio'] } },
        {
          type: 'group', id: 'datos', columns: 2,
          fields: [
            {
              key: 'persona.documento', type: 'text', layout: { col: 6 },
              validation: { pattern: '^[0-9]+$', validators: [{ name: 'dni' }] },
              logic: { showWhen: { all: [{ field: 'tipo', operator: 'eq', value: 'p' }, { not: { field: 'tipo', operator: 'empty' } }] } },
            },
          ],
          logic: { hideWhen: { any: [{ field: 'tipo', operator: 'in', value: ['e'] }] } },
        },
      ]),
    );
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  describe('raíz', () => {
    it('rechaza algo que no es un objeto', () => {
      expect(service.validate(null)).toEqual({ valid: false, errors: [{ path: '$', message: expect.any(String) }] });
      expect(paths('hola')).toEqual(['$']);
    });

    it('exige version 1.0 e id con formato', () => {
      expect(paths(schema([{ key: 'a', type: 'text' }], { version: '2.0' }))).toEqual(['version']);
      expect(paths(schema([{ key: 'a', type: 'text' }], { id: '1alta' }))).toEqual(['id']);
      expect(paths(schema([{ key: 'a', type: 'text' }], { id: undefined }))).toEqual(['id']);
    });

    it('exige fields no vacío', () => {
      expect(paths(schema([]))).toEqual(['fields']);
      expect(paths({ version: '1.0', id: 'a' })).toEqual(['fields']);
    });
  });

  describe('campos', () => {
    it('valida formato de key y tipo soportado', () => {
      expect(paths(schema([{ key: '1abc', type: 'text' }]))).toEqual(['fields[0].key']);
      expect(paths(schema([{ key: 'a', type: 'slider' }]))).toEqual(['fields[0].type']);
    });

    it('marca nodos inválidos', () => {
      expect(paths(schema([null]))).toEqual(['fields[0]']);
    });

    it('exige options en select, multiselect y radio', () => {
      expect(paths(schema([
        { key: 'a', type: 'select' }, { key: 'b', type: 'multiselect' }, { key: 'c', type: 'radio' },
      ]))).toEqual(['fields[0].options', 'fields[1].options', 'fields[2].options']);
    });

    it('detecta dependsOn hacia campos desconocidos y source desconocido', () => {
      expect(paths(schema([
        { key: 'a', type: 'select', options: { source: 'dependent', dependsOn: 'nope', map: {} } },
        { key: 'b', type: 'select', options: { source: 'remote', endpoint: '/x', dependsOn: ['a', 'nope'] } },
        { key: 'c', type: 'select', options: { source: 'ftp' } },
      ]))).toEqual(['fields[0].options.dependsOn', 'fields[1].options.dependsOn', 'fields[2].options.source']);
    });

    it('detecta patrones regex inválidos', () => {
      expect(paths(schema([{ key: 'a', type: 'text', validation: { pattern: '(' } }]))).toEqual(['fields[0].validation.pattern']);
    });

    it('detecta validadores sin name o no registrados (sync y async)', () => {
      const result = service.validate(schema([
        { key: 'a', type: 'text', validation: { validators: [{ name: 'dni' }, { name: 'iban' }, {}], asyncValidators: [{ name: 'nifDisponible' }] } },
      ]));
      expect(result.errors.map((e) => e.message)).toEqual([
        'Validador no registrado: iban', 'name obligatorio', 'Validador no registrado: nifDisponible',
      ]);
    });

    it('exige layout.col entre 1 y 12', () => {
      expect(paths(schema([{ key: 'a', type: 'text', layout: { col: 13 } }]))).toEqual(['fields[0].layout.col']);
      expect(paths(schema([{ key: 'a', type: 'text', layout: { col: 0 } }]))).toEqual(['fields[0].layout.col']);
    });
  });

  describe('grupos', () => {
    it('exige id, columns válidas y fields', () => {
      expect(paths(schema([{ type: 'group', columns: 13, fields: [] }]))).toEqual([
        'fields[0].id', 'fields[0].columns', 'fields[0].fields',
      ]);
    });

    it('valida los campos anidados con su ruta', () => {
      expect(paths(schema([{ type: 'group', id: 'g', fields: [{ key: 'a', type: 'nope' }] }]))).toEqual(['fields[0].fields[0].type']);
    });

    it('las keys dentro de grupos son referenciables desde la lógica', () => {
      expect(service.validate(schema([
        { type: 'group', id: 'g', fields: [{ key: 'a', type: 'text' }] },
        { key: 'b', type: 'text', logic: { showWhen: { field: 'a', operator: 'notEmpty' } } },
      ])).valid).toBe(true);
    });
  });

  describe('lógica condicional', () => {
    it('detecta campos y operadores desconocidos en todas las reglas', () => {
      expect(paths(schema([
        { key: 'a', type: 'text' },
        {
          key: 'b', type: 'text',
          logic: {
            showWhen: { field: 'nope', operator: 'eq', value: 1 },
            hideWhen: { field: 'a', operator: 'like' },
            requiredWhen: { all: [{ field: 'a', operator: 'eq', value: 1 }, { any: [{ field: 'x', operator: 'eq', value: 1 }] }] },
            disabledWhen: { not: { field: 'y', operator: 'truthy' } },
          },
        },
      ]))).toEqual([
        'fields[1].logic.showWhen.field',
        'fields[1].logic.hideWhen.operator',
        'fields[1].logic.requiredWhen.all[1].any[0].field',
        'fields[1].logic.disabledWhen.not.field',
      ]);
    });

    it('rechaza grupos de reglas sin all, any ni not', () => {
      expect(paths(schema([{ key: 'a', type: 'text', logic: { showWhen: {} } }]))).toEqual(['fields[0].logic.showWhen']);
    });
  });

  describe('layout del formulario', () => {
    it('exige columns entero entre 1 y 12', () => {
      expect(paths(schema([{ key: 'a', type: 'text' }], { layout: { columns: 20 } }))).toEqual(['layout.columns']);
      expect(paths(schema([{ key: 'a', type: 'text' }], { layout: { columns: 2.5 } }))).toEqual(['layout.columns']);
      expect(paths(schema([{ key: 'a', type: 'text' }], { layout: { columns: 3 } }))).toEqual([]);
    });

    it('exige que gap sea una longitud CSS simple', () => {
      ['1rem', '12px', '0', '1.5em', '5%'].forEach((gap) =>
        expect(paths(schema([{ key: 'a', type: 'text' }], { layout: { gap } })), gap).toEqual([]));
      ['url(x)', 'var(--a)', 'calc(1px + 1px)', '1rem; color: red', 'grande'].forEach((gap) =>
        expect(paths(schema([{ key: 'a', type: 'text' }], { layout: { gap } })), gap).toEqual(['layout.gap']));
    });
  });

  describe('orígenes de opciones', () => {
    it('static exige items, dependent exige map y remote exige endpoint', () => {
      expect(paths(schema([
        { key: 'p', type: 'select', options: [] },
        { key: 'a', type: 'select', options: { source: 'static' } },
        { key: 'b', type: 'select', options: { source: 'dependent', dependsOn: 'p' } },
        { key: 'c', type: 'select', options: { source: 'dependent', dependsOn: 'p', map: [] } },
        { key: 'd', type: 'select', options: { source: 'remote' } },
        { key: 'e', type: 'select', options: { source: 'remote', endpoint: '' } },
      ]))).toEqual([
        'fields[1].options.items', 'fields[2].options.map', 'fields[3].options.map',
        'fields[4].options.endpoint', 'fields[5].options.endpoint',
      ]);
    });
  });

  describe('props de los campos currency', () => {
    it('acepta moneda, formato e idioma válidos', () => {
      expect(paths(schema([{ key: 'i', type: 'currency', props: { currency: 'GBP', numberFormat: 'en', wordsLanguage: 'es', amountInWords: false } }]))).toEqual([]);
    });

    it('rechaza valores que el adaptador tendría que ignorar', () => {
      expect(paths(schema([{
        key: 'i', type: 'currency',
        props: { currency: 'EURO', numberFormat: 'fr', wordsLanguage: 'de', wordsUppercase: 'sí', currencyWords: { singular: 'x' } },
      }]))).toEqual([
        'fields[0].props.currency', 'fields[0].props.numberFormat', 'fields[0].props.wordsLanguage',
        'fields[0].props.wordsUppercase', 'fields[0].props.currencyWords',
      ]);
    });
  });

  describe('value de las condiciones', () => {
    const conLogica = (rule: unknown) => schema([{ key: 'a', type: 'text' }, { key: 'b', type: 'text', logic: { showWhen: rule } }]);

    it('es obligatorio salvo con empty, notEmpty, truthy y falsy', () => {
      expect(paths(conLogica({ field: 'a', operator: 'eq' }))).toEqual(['fields[1].logic.showWhen.value']);
      expect(paths(conLogica({ field: 'a', operator: 'in' }))).toEqual(['fields[1].logic.showWhen.value']);
      ['empty', 'notEmpty', 'truthy', 'falsy'].forEach((operator) =>
        expect(paths(conLogica({ field: 'a', operator })), operator).toEqual([]));
    });

    it('acepta null como valor explícito', () => {
      expect(paths(conLogica({ field: 'a', operator: 'eq', value: null }))).toEqual([]);
    });
  });

  describe('tablas de datos (table)', () => {
    const tabla = (extra: Record<string, unknown> = {}) => ({
      type: 'table', id: 'clientes', columns: [{ key: 'nombre', label: 'Nombre' }], ...extra,
    });

    it('acepta una tabla completa', () => {
      const result = service.validate(schema([tabla({
        title: 'Clientes', filter: true, pageSize: 10, pageSizeOptions: [5, 10], selectable: true,
        sort: { key: 'nombre', direction: 'desc' }, dataKey: 'datos.clientes',
        rows: [{ nombre: 'Ana' }],
        columns: [
          { key: 'nombre', label: 'Nombre', col: 4 },
          { key: 'titular.importe', label: 'Importe', type: 'currency', currency: 'GBP', sortable: false },
          { key: 'estado', label: 'Estado', type: 'map', map: { A: 'Alta' } },
        ],
        actions: [{ name: 'editar', label: 'Editar' }],
        logic: { showWhen: { field: 'ver', operator: 'truthy' } },
      }), { key: 'ver', type: 'checkbox' }]));
      expect(result.errors).toEqual([]);
    });

    it('exige id y columnas válidas', () => {
      expect(paths(schema([tabla({ id: '1mal' })]))).toContain('fields[0].id');
      expect(paths(schema([tabla({ columns: [] })]))).toContain('fields[0].columns');
      const cols = (columns: unknown[]) => paths(schema([tabla({ columns })]));
      expect(cols([{ label: 'x' }])).toContain('fields[0].columns[0].key');
      expect(cols([{ key: 'a' }])).toContain('fields[0].columns[0].label');
      expect(cols([{ key: 'a', label: 'A' }, { key: 'a', label: 'B' }])).toContain('fields[0].columns[1].key');
      expect(cols([{ key: 'a', label: 'A', type: 'imagen' }])).toContain('fields[0].columns[0].type');
      expect(cols([{ key: 'a', label: 'A', type: 'map' }])).toContain('fields[0].columns[0].map');
      expect(cols([{ key: 'a', label: 'A', col: 13 }])).toContain('fields[0].columns[0].col');
      expect(cols([{ key: 'a', label: 'A', type: 'currency', currency: 'euro' }])).toContain('fields[0].columns[0].currency');
    });

    it('valida paginación, orden, filas, dataKey y acciones', () => {
      expect(paths(schema([tabla({ pageSize: 0 })]))).toContain('fields[0].pageSize');
      expect(paths(schema([tabla({ pageSizeOptions: [] })]))).toContain('fields[0].pageSizeOptions');
      expect(paths(schema([tabla({ sort: { key: 'otra' } })]))).toContain('fields[0].sort.key');
      expect(paths(schema([tabla({ sort: { key: 'nombre', direction: 'arriba' } })]))).toContain('fields[0].sort.direction');
      expect(paths(schema([tabla({ rows: ['x'] })]))).toContain('fields[0].rows');
      expect(paths(schema([tabla({ dataKey: 'con espacios' })]))).toContain('fields[0].dataKey');
      expect(paths(schema([tabla({ actions: [{ label: 'x' }] })]))).toContain('fields[0].actions[0].name');
      expect(paths(schema([tabla({ actions: [{ name: 'a', label: 'A' }, { name: 'a', label: 'B' }] })]))).toContain('fields[0].actions[1].name');
      expect(paths(schema([tabla({ actions: [{ name: 'a' }] })]))).toContain('fields[0].actions[0].label');
    });

    it('acepta rutas ctx.nombre en las condiciones y reserva la clave ctx', () => {
      const con = (fields: unknown[]) => paths(schema(fields as never));
      const campo = (field: string) => ({ key: 'a', type: 'text', logic: { showWhen: { field, operator: 'truthy' } } });
      expect(con([campo('ctx.modo')])).toEqual([]);
      expect(con([campo('ctx.')])).toContain('fields[0].logic.showWhen.field');
      expect(con([{ key: 'ctx', type: 'text' }])).toContain('fields[0].key');
      expect(con([{ type: 'array', key: 'ctx', fields: [{ key: 'x', type: 'text' }] }])).toContain('fields[0].key');
    });

    it('valida los nodos slot: name obligatorio, nada de listas, y logic con sus reglas', () => {
      const con = (fields: unknown[]) => paths(schema(fields));
      expect(con([{ type: 'slot', name: 'resumen' }, { key: 'a', type: 'text' }])).toEqual([]);
      expect(con([{ type: 'group', id: 'g', fields: [{ type: 'slot', name: 'x' }] }])).toEqual([]);
      expect(con([{ type: 'slot' }])).toContain('fields[0].name');
      expect(con([{ type: 'slot', name: 'con espacios' }])).toContain('fields[0].name');
      expect(con([{ type: 'array', key: 'l', fields: [{ type: 'slot', name: 'x' }] }])).toContain('fields[0].fields[0].type');
      expect(con([{ type: 'slot', name: 'x', logic: { showWhen: { field: 'noExiste', operator: 'truthy' } } }])).toContain('fields[0].logic.showWhen.field');
    });

    it('valida layout.resetOnHide', () => {
      expect(paths(schema([{ key: 'a', type: 'text' }], { layout: { resetOnHide: false } }))).toEqual([]);
      expect(paths(schema([{ key: 'a', type: 'text' }], { layout: { resetOnHide: 'no' } }))).toContain('layout.resetOnHide');
    });

    it('valida el nombre de template de una columna', () => {
      const col = (template: unknown) => paths(schema([tabla({ columns: [{ key: 'a', label: 'A', template } as never] })]));
      expect(col('estado')).toEqual([]);
      expect(col('con espacios')).toContain('fields[0].columns[0].template');
      expect(col(3)).toContain('fields[0].columns[0].template');
    });

    it('valida selectableWhen y headerSelects', () => {
      const con = (extra: Record<string, unknown>) => paths(schema([tabla(extra)]));
      const regla = { field: './estado', operator: 'eq', value: 'FIN' };
      expect(con({ selectable: 'multiple', selectableWhen: regla, headerSelects: 'page' })).toEqual([]);
      expect(con({ selectableWhen: regla })).toContain('fields[0].selectableWhen');
      expect(con({ selectable: true, selectableWhen: { field: './x', operator: 'raro', value: 1 } })).toContain('fields[0].selectableWhen.operator');
      expect(con({ selectable: 'multiple', headerSelects: 'todo' })).toContain('fields[0].headerSelects');
      expect(con({ selectable: true, headerSelects: 'page' })).toContain('fields[0].headerSelects');
    });

    it('valida las columnas badge y link', () => {
      const col = (c: Record<string, unknown>) => paths(schema([tabla({ columns: [{ key: 'a', label: 'A', ...c }] })]));
      expect(col({ type: 'badge', variants: { X: 'ok' } })).toEqual([]);
      expect(col({ type: 'badge', variants: { X: 'rojo' } })).toContain('fields[0].columns[0].variants');
      expect(col({ type: 'text', variants: { X: 'ok' } })).toContain('fields[0].columns[0].variants');
      expect(col({ type: 'link', href: '/x/{id}' })).toEqual([]);
      expect(col({ type: 'link', href: 'https://a.es/{id}' })).toEqual([]);
      expect(col({ type: 'link' })).toContain('fields[0].columns[0].href');
      expect(col({ type: 'link', href: 'javascript:alert(1)' })).toContain('fields[0].columns[0].href');
      expect(col({ type: 'link', href: '//evil.com' })).toContain('fields[0].columns[0].href');
      expect(col({ type: 'text', href: '/x' })).toContain('fields[0].columns[0].href');
    });

    it('valida icon, tooltip y las reglas de las acciones (cualquier ./campo de la fila vale)', () => {
      const con = (a: Record<string, unknown>) => paths(schema([tabla({ actions: [{ name: 'a', label: 'A', ...a }] })]));
      expect(con({ icon: '', tooltip: 3 })).toEqual(expect.arrayContaining(['fields[0].actions[0].icon', 'fields[0].actions[0].tooltip']));
      expect(con({ showWhen: { field: './cualquiera', operator: 'eq', value: 1 } })).toEqual([]);
      expect(con({ disabledWhen: { field: './x', operator: 'raro', value: 1 } })).toContain('fields[0].actions[0].disabledWhen.operator');
      expect(con({ showWhen: { field: 'noExiste', operator: 'eq', value: 1 } })).toContain('fields[0].actions[0].showWhen.field');
    });

    it('valida source: endpoint, mode, pageSize en modo server y dependsOn', () => {
      const con = (source: unknown, extra: Record<string, unknown> = {}) => paths(schema([tabla({ source, ...extra }), { key: 'estado', type: 'text' }]));
      expect(con({ endpoint: '/api/x' })).toEqual([]);
      expect(con({ endpoint: '/api/x', mode: 'server', dependsOn: ['estado'] }, { pageSize: 10 })).toEqual([]);
      expect(con({})).toContain('fields[0].source.endpoint');
      expect(con('/api/x')).toContain('fields[0].source');
      expect(con({ endpoint: '/api/x', mode: 'remoto' })).toContain('fields[0].source.mode');
      expect(con({ endpoint: '/api/x', mode: 'server' })).toContain('fields[0].pageSize');
      expect(con({ endpoint: '/api/x', dependsOn: ['fantasma'] })).toContain('fields[0].source.dependsOn');
      expect(con({ endpoint: '/api/x', dependsOn: 'estado' })).toContain('fields[0].source.dependsOn');
    });

    it('source.externalParams deja que dependsOn nombre claves que no son campos; requireParams y externalParams deben ser booleanos', () => {
      const con = (source: unknown) => paths(schema([tabla({ source })]));
      expect(con({ endpoint: '/x', dependsOn: ['texto', 'filtros.estado'], externalParams: true, requireParams: false })).toEqual([]);
      expect(con({ endpoint: '/x', dependsOn: ['texto'] })).toContain('fields[0].source.dependsOn');
      expect(con({ endpoint: '/x', dependsOn: ['con espacios'], externalParams: true })).toContain('fields[0].source.dependsOn');
      expect(con({ endpoint: '/x', externalParams: 'si' })).toContain('fields[0].source.externalParams');
      expect(con({ endpoint: '/x', requireParams: 0 })).toContain('fields[0].source.requireParams');
    });

    it('valida selectable, selectionKey, exportCsv y filter de columna', () => {
      const con = (extra: Record<string, unknown>) => paths(schema([tabla(extra)]));
      expect(con({ selectable: 'multiple', selectionKey: 'id', exportCsv: { filename: 'informe 2024' } })).toEqual([]);
      expect(con({ selectable: 'single', exportCsv: true })).toEqual([]);
      expect(con({ selectable: 'varias' })).toContain('fields[0].selectable');
      expect(con({ selectable: true, selectionKey: 'id' })).toContain('fields[0].selectionKey');
      expect(con({ selectable: 'multiple', selectionKey: 'con espacios' })).toContain('fields[0].selectionKey');
      expect(con({ exportCsv: 'si' })).toContain('fields[0].exportCsv');
      expect(con({ exportCsv: { nombre: 'x' } })).toContain('fields[0].exportCsv');
      expect(con({ exportCsv: { filename: '../etc/passwd' } })).toContain('fields[0].exportCsv.filename');
      expect(con({ columns: [{ key: 'a', label: 'A', filter: 'si' }] })).toContain('fields[0].columns[0].filter');
    });

    it('sort admite una lista solo con multiSort, sin columnas repetidas', () => {
      const con = (extra: Record<string, unknown>) => paths(schema([tabla({ columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], ...extra })]));
      expect(con({ multiSort: true, sort: [{ key: 'a' }, { key: 'b', direction: 'desc' }] })).toEqual([]);
      expect(con({ sort: [{ key: 'a' }] })).toEqual([]);
      expect(con({ sort: [{ key: 'a' }, { key: 'b' }] })).toContain('fields[0].sort');
      expect(con({ multiSort: true, sort: [{ key: 'a' }, { key: 'a' }] })).toContain('fields[0].sort[1].key');
      expect(con({ multiSort: true, sort: [{ key: 'a' }, { key: 'x' }] })).toContain('fields[0].sort[1].key');
      expect(con({ multiSort: true, sort: [{ key: 'a', direction: 'arriba' }] })).toContain('fields[0].sort[0].direction');
      expect(con({ multiSort: 'si' })).toContain('fields[0].multiSort');
    });

    it('persistState y stateKey', () => {
      const con = (extra: Record<string, unknown>) => paths(schema([tabla(extra)]));
      expect(con({ persistState: 'local', stateKey: 'expedientes-2' })).toEqual([]);
      expect(con({ persistState: true })).toEqual([]);
      expect(con({ persistState: 'cookie' })).toContain('fields[0].persistState');
      expect(con({ stateKey: 'con espacios' })).toContain('fields[0].stateKey');
    });

    it('resizableColumns solo admite booleanos', () => {
      expect(paths(schema([tabla({ resizableColumns: true })]))).toEqual([]);
      expect(paths(schema([tabla({ resizableColumns: 'si' })]))).toContain('fields[0].resizableColumns');
    });

    it('reorderableColumns solo admite booleanos', () => {
      expect(paths(schema([tabla({ reorderableColumns: true })]))).toEqual([]);
      expect(paths(schema([tabla({ reorderableColumns: 1 })]))).toContain('fields[0].reorderableColumns');
    });

    it('pinnableColumns solo admite booleanos', () => {
      expect(paths(schema([tabla({ pinnableColumns: true })]))).toEqual([]);
      expect(paths(schema([tabla({ pinnableColumns: 'si' })]))).toContain('fields[0].pinnableColumns');
    });

    it('frozen solo admite booleanos y las columnas fijas van primero', () => {
      const cols = (...frozen: unknown[]) => paths(schema([tabla({ columns: frozen.map((f, i) => ({ key: `c${i}`, label: `C${i}`, frozen: f })) })]));
      expect(cols(true, true, false)).toEqual([]);
      expect(cols(false, false)).toEqual([]);
      expect(cols(true, 'si')).toContain('fields[0].columns[1].frozen');
      expect(cols(false, true)).toContain('fields[0].columns[1].frozen');
      expect(cols(true, false, true)).toContain('fields[0].columns[2].frozen');
    });

    it('html solo admite booleanos y columnas de tipo text', () => {
      const col = (c: object) => paths(schema([tabla({ columns: [{ key: 'a', label: 'A', ...c }] })]));
      expect(col({ html: true })).toEqual([]);
      expect(col({ html: true, type: 'text' })).toEqual([]);
      expect(col({ html: 'si' })).toContain('fields[0].columns[0].html');
      expect(col({ html: true, type: 'currency' })).toContain('fields[0].columns[0].html');
    });

    it('source no se combina con rows ni dataKey', () => {
      expect(paths(schema([tabla({ source: { endpoint: '/x' }, rows: [] })]))).toContain('fields[0].source');
      expect(paths(schema([tabla({ source: { endpoint: '/x' }, dataKey: 'a' })]))).toContain('fields[0].source');
    });

    it('source.dependsOn admite ./campo dentro de una lista, y solo ahí', () => {
      const rel = { endpoint: '/x', dependsOn: ['./pais'] };
      const lista = { type: 'array', key: 'l', fields: [{ key: 'pais', type: 'text' }, tabla({ source: rel })] };
      expect(paths(schema([lista]))).toEqual([]);
      expect(paths(schema([tabla({ source: rel })]))).toContain('fields[0].source.dependsOn');
    });

    it('no tiene key: no cuenta como campo para las referencias', () => {
      const dep = { key: 'x', type: 'text', logic: { showWhen: { field: 'clientes', operator: 'truthy' } } };
      expect(paths(schema([tabla(), dep]))).toContain('fields[1].logic.showWhen.field');
    });

    it('no se admite dentro de una lista con display "table"', () => {
      const lista = { type: 'array', key: 'l', display: 'table', fields: [tabla()] };
      expect(paths(schema([lista]))).toContain('fields[0].fields[0].type');
      expect(service.validate(schema([{ ...lista, display: 'rows' }])).valid).toBe(true);
    });
  });

  describe('listas repetibles (array)', () => {
    const lista = (extra: Record<string, unknown> = {}, fields: unknown[] = [{ key: 'concepto', type: 'text' }]) => ({
      type: 'array', key: 'lineas', fields, ...extra,
    });

    it('acepta una lista con filas, límites y reglas relativas', () => {
      const result = service.validate(schema([
        { key: 'tipo', type: 'text' },
        lista({ display: 'table', minItems: 1, maxItems: 5 }, [
          { key: 'cantidad', type: 'number' },
          { key: 'motivo', type: 'text', logic: { requiredWhen: { all: [{ field: './cantidad', operator: 'gt', value: 10 }, { field: 'tipo', operator: 'notEmpty' }] } } },
        ]),
      ]));
      expect(result.errors).toEqual([]);
    });

    it('exige key, fields y valida display, columns y los límites', () => {
      expect(paths(schema([{ type: 'array', fields: [{ key: 'a', type: 'text' }] }]))).toContain('fields[0].key');
      expect(paths(schema([lista({}, [])]))).toContain('fields[0].fields');
      expect(paths(schema([lista({ display: 'grid' })]))).toContain('fields[0].display');
      expect(paths(schema([lista({ columns: 13 })]))).toContain('fields[0].columns');
      expect(paths(schema([lista({ minItems: -1 })]))).toContain('fields[0].minItems');
      expect(paths(schema([lista({ maxItems: 0 })]))).toContain('fields[0].maxItems');
      expect(paths(schema([lista({ minItems: 3, maxItems: 2 })]))).toContain('fields[0].maxItems');
    });

    it('no admite una lista dentro de otra', () => {
      expect(paths(schema([lista({}, [lista({ key: 'sub' })])]))).toContain('fields[0].fields[0].type');
    });

    it('en display "table" no admite grupos ni campos que se oculten', () => {
      const grupo = { type: 'group', id: 'g', fields: [{ key: 'a', type: 'text' }] };
      expect(paths(schema([lista({ display: 'table' }, [grupo])]))).toContain('fields[0].fields[0].type');
      const oculto = { key: 'a', type: 'text', logic: { hideWhen: { field: './b', operator: 'truthy' } } };
      expect(paths(schema([lista({ display: 'table' }, [oculto, { key: 'b', type: 'checkbox' }])]))).toContain('fields[0].fields[0].logic');
      expect(service.validate(schema([lista({ display: 'rows' }, [oculto, { key: 'b', type: 'checkbox' }])])).valid).toBe(true);
    });

    it('las rutas relativas solo valen dentro de una lista y deben existir en la fila', () => {
      const rel = (field: string) => ({ key: 'x', type: 'text', logic: { showWhen: { field, operator: 'truthy' } } });
      expect(paths(schema([rel('./otro')]))).toContain('fields[0].logic.showWhen.field');
      expect(paths(schema([lista({}, [rel('./fantasma')])]))).toContain('fields[0].fields[0].logic.showWhen.field');
    });

    it('valida los totales', () => {
      const campos = [{ key: 'cantidad', type: 'number' }, { key: 'nota', type: 'text' }];
      const con = (totals: unknown[]) => paths(schema([lista({ totals }, campos)]));
      expect(con([{ label: 'Total', op: 'sum', field: 'cantidad' }, { label: 'Filas', op: 'count' }])).toEqual([]);
      expect(con([{ op: 'sum', field: 'cantidad' }])).toContain('fields[0].totals[0].label');
      expect(con([{ label: 'x', op: 'median', field: 'cantidad' }])).toContain('fields[0].totals[0].op');
      expect(con([{ label: 'x', op: 'sum' }])).toContain('fields[0].totals[0].field');
      expect(con([{ label: 'x', op: 'sum', field: 'fantasma' }])).toContain('fields[0].totals[0].field');
      expect(con([{ label: 'x', op: 'sum', field: 'nota' }])).toContain('fields[0].totals[0].field');
      expect(con([{ label: 'x', op: 'count', field: 'nota' }])).toEqual([]);
    });

    it('dependsOn admite rutas relativas dentro de una lista, y solo ahí', () => {
      const dep = { key: 'municipio', type: 'select', options: { source: 'dependent', dependsOn: './provincia', map: {} } };
      expect(paths(schema([lista({}, [{ key: 'provincia', type: 'text' }, dep])]))).toEqual([]);
      expect(paths(schema([lista({}, [dep])]))).toContain('fields[0].fields[0].options.dependsOn');
      expect(paths(schema([dep]))).toContain('fields[0].options.dependsOn');
      const remote = { key: 'calle', type: 'select', options: { source: 'remote', endpoint: '/c', dependsOn: ['./fantasma'] } };
      expect(paths(schema([lista({}, [remote])]))).toContain('fields[0].fields[0].options.dependsOn');
    });

    it('las claves de la fila no son claves de la raíz', () => {
      const dep = { key: 'x', type: 'text', logic: { showWhen: { field: 'concepto', operator: 'truthy' } } };
      expect(paths(schema([lista(), dep]))).toContain('fields[1].logic.showWhen.field');
    });
  });
});

describe('SchemaValidatorService con tipos registrados', () => {
  it('acepta tipos registrados con provideDynamicForms({ types }) y rechaza el resto', () => {
    TestBed.configureTestingModule({ providers: [provideDynamicForms({ types: [{ name: 'firma' }] })] });
    const service = TestBed.inject(SchemaValidatorService);
    const paths = (s: unknown) => service.validate(s).errors.map((e) => e.path);
    expect(paths(schema([{ key: 'f', type: 'firma' }]))).toEqual([]);
    expect(paths(schema([{ key: 'f', type: 'garabato' }]))).toEqual(['fields[0].type']);
  });
});
