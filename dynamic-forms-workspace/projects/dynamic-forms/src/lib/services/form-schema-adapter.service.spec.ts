import { TestBed } from '@angular/core/testing';
import { DEFAULT_TABLE_TEXTS } from '../utils/table-texts';
import { FormControl, FormGroup } from '@angular/forms';
import { ConfigOption, FORMLY_CONFIG, FormlyFieldConfig } from '@ngx-formly/core';
import { Observable, firstValueFrom, of } from 'rxjs';
import {
  DfOptionsProvider, DfResolvedConfig, DfTheme, DfValidatorDefinition, DynamicFormsSchemaError,
} from '../models/config.model';
import { DfFormSchema, DfNode, DfOption } from '../models/schema.model';
import { DF_OPTIONS_PROVIDER, DF_VALIDATORS, DYNAMIC_FORMS_CONFIG } from '../tokens/dynamic-forms.tokens';
import { FormSchemaAdapterService } from './form-schema-adapter.service';

/** Tema falso: solo nombres, sin componentes, para aislar la traducción a Formly. */
const THEME: DfTheme = {
  name: 'test',
  typeMap: { text: 't-input', email: 't-input', number: 't-input', select: 't-select', multiselect: 't-select', hidden: 't-hidden' },
  fieldWrappers: ['t-field'],
  groupWrapper: 't-group',
  typeProps: { select: { appearance: 'outline' } },
};

const VALIDATORS: DfValidatorDefinition[] = [
  { name: 'par', message: 'Debe ser par ({{label}})', validate: (c) => Number(c.value) % 2 === 0 },
  { name: 'minimo', message: 'Mínimo {{min}} en {{label}}', validate: (c, args) => Number(c.value) >= Number(args?.['min']) },
  { name: 'fn', message: (args) => `fn:${String(args?.['x'])}`, validate: () => true },
  { name: 'remoto', async: true, message: 'ocupado', validate: () => of(true) },
];

interface Setup {
  strictSchema?: boolean;
  defaultResetOnHide?: boolean;
  optionsProvider?: DfOptionsProvider;
  maxLengthMode?: 'weighted' | 'chars';
  currency?: Partial<DfResolvedConfig['currency']>;
  theme?: DfTheme;
  formly?: ConfigOption;
}

function setup(opts: Setup = {}): FormSchemaAdapterService {
  const config: DfResolvedConfig = {
    theme: opts.theme ?? THEME,
    strictSchema: opts.strictSchema ?? true,
    defaultResetOnHide: opts.defaultResetOnHide ?? true,
    maxLengthMode: opts.maxLengthMode ?? 'weighted',
    currency: { code: 'EUR', numberFormat: 'es', wordsLanguage: 'es', amountInWords: true, wordsUppercase: true, ...opts.currency },
    tableTexts: DEFAULT_TABLE_TEXTS,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DYNAMIC_FORMS_CONFIG, useValue: config },
      { provide: DF_VALIDATORS, multi: true, useValue: VALIDATORS },
      ...(opts.formly ? [{ provide: FORMLY_CONFIG, multi: true, useValue: opts.formly }] : []),
      ...(opts.optionsProvider ? [{ provide: DF_OPTIONS_PROVIDER, useValue: opts.optionsProvider }] : []),
    ],
  });
  return TestBed.inject(FormSchemaAdapterService);
}

const schema = (fields: DfNode[], extra: Partial<DfFormSchema> = {}): DfFormSchema =>
  ({ version: '1.0', id: 'test', fields, ...extra });

/** Campos de primer nivel (dentro del grid raíz). */
const fieldsOf = (svc: FormSchemaAdapterService, s: DfFormSchema): FormlyFieldConfig[] => svc.toFormly(s)[0].fieldGroup!;

/** Simula un campo Formly anidado cuyo modelo raíz es `model`. */
const inModel = (model: unknown): FormlyFieldConfig => ({ parent: { parent: { model } } }) as FormlyFieldConfig;

const expr = <T>(cfg: FormlyFieldConfig, name: string, model: unknown): T =>
  (cfg.expressions![name] as (f: FormlyFieldConfig) => T)(inModel(model));

describe('FormSchemaAdapterService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  describe('validación del esquema', () => {
    const invalido = schema([{ key: 'a', type: 'text', validation: { validators: [{ name: 'noExiste' }] } }]);

    it('lanza DynamicFormsSchemaError en modo estricto', () => {
      const svc = setup();
      expect(() => svc.toFormly(invalido)).toThrowError(DynamicFormsSchemaError);
    });

    it('en modo no estricto avisa, continúa y omite el alias desconocido', () => {
      const svc = setup({ strictSchema: false });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const [a] = fieldsOf(svc, invalido);
      expect(warn).toHaveBeenCalledWith('[dynamic-forms] Esquema con incidencias:', expect.any(Array));
      expect(a.validators).toEqual({});
    });
  });

  describe('grid', () => {
    it('por defecto pone un campo por fila (ocupa las 12 columnas)', () => {
      const [root] = setup().toFormly(schema([{ key: 'a', type: 'text' }]));
      expect(root.fieldGroupClassName).toBe('df-grid df-grid--1');
      expect(root.fieldGroup![0].className).toBe('df-col-12');
    });

    it('un grupo sin columns también pone un campo por fila', () => {
      const [g] = fieldsOf(setup(), schema([{ type: 'group', id: 'g', fields: [{ key: 'a', type: 'text' }] }]));
      expect(g.fieldGroupClassName).toBe('df-grid df-grid--1');
      expect(g.fieldGroup![0].className).toBe('df-col-12');
    });

    it('reparte el span según las columnas del padre', () => {
      const [root] = setup().toFormly(schema([{ key: 'a', type: 'text' }], { layout: { columns: 3 } }));
      expect(root.fieldGroupClassName).toBe('df-grid df-grid--3');
      expect(root.fieldGroup![0].className).toBe('df-col-4');
    });

    it('respeta layout.col, order y cssClass', () => {
      const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text', layout: { col: 6, order: 2, cssClass: 'extra' } }]));
      expect(a.className).toBe('df-col-6 df-order-2 extra');
    });

    it('acota layout.col a 1..12 en modo no estricto', () => {
      const svc = setup({ strictSchema: false });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const [a, b] = fieldsOf(svc, schema([
        { key: 'a', type: 'text', layout: { col: 20 } },
        { key: 'b', type: 'text', layout: { col: -3 } },
      ]));
      expect(a.className).toBe('df-col-12');
      expect(b.className).toBe('df-col-1');
    });

    it('un grupo sin cssClass ocupa la fila entera', () => {
      const [g] = fieldsOf(setup(), schema([{ type: 'group', id: 'g', fields: [{ key: 'a', type: 'text' }] }]));
      expect(g.className).toBe('df-col-12');
    });

    it('los grupos crean su propio grid y wrapper', () => {
      const [g] = fieldsOf(setup(), schema([
        { type: 'group', id: 'datos', title: 'Datos', description: 'desc', columns: 2, cssClass: 'card', fields: [{ key: 'a', type: 'text' }] },
      ]));
      expect(g.key).toBeUndefined();
      expect(g.fieldGroupClassName).toBe('df-grid df-grid--2');
      expect(g.className).toBe('df-col-12 card');
      expect(g.wrappers).toEqual(['t-group']);
      expect(g.props).toEqual({ title: 'Datos', description: 'desc', groupId: 'datos', cssClass: 'card' });
      expect(g.fieldGroup![0].className).toBe('df-col-6');
    });
  });

  describe('campos', () => {
    it('mapea el tipo con theme.typeMap y cae al tipo del contrato si falta', () => {
      const [a, b] = fieldsOf(setup(), schema([{ key: 'a', type: 'email' }, { key: 'b', type: 'textarea' }]));
      expect(a.type).toBe('t-input');
      expect(b.type).toBe('textarea');
    });

    it('traslada props, validación nativa y props por tipo', () => {
      const [a] = fieldsOf(setup(), schema([{
        key: 'edad', type: 'number', label: 'Edad', placeholder: 'años', description: 'ayuda', defaultValue: 18,
        readonly: true, validation: { required: true, min: 18, max: 99, minLength: 1, maxLength: 2, pattern: '^\\d+$' },
      }]));
      expect(a.key).toBe('edad');
      expect(a.defaultValue).toBe(18);
      expect(a.wrappers).toEqual(['t-field']);
      expect(a.hide).toBe(false);
      expect(a.props).toEqual(expect.objectContaining({
        label: 'Edad', placeholder: 'años', description: 'ayuda', readonly: true, disabled: false, required: true,
        min: 18, max: 99, minLength: 1, maxLength: 2, pattern: '^\\d+$', type: 'number',
      }));
    });

    it('añade multiple en multiselect y las props del tema', () => {
      const [m, s] = fieldsOf(setup(), schema([
        { key: 'm', type: 'multiselect', options: [] },
        { key: 's', type: 'select', options: [] },
      ]));
      expect(m.props!['multiple']).toBe(true);
      expect(s.props!['appearance']).toBe('outline');
    });

    it('field.props tiene prioridad sobre las props calculadas', () => {
      const [s] = fieldsOf(setup(), schema([{ key: 's', type: 'select', options: [], props: { appearance: 'fill', label: 'X' } }]));
      expect(s.props!['appearance']).toBe('fill');
      expect(s.props!['label']).toBe('X');
    });

    it('los hidden no llevan wrappers ni columna', () => {
      const [h] = fieldsOf(setup(), schema([{ key: 'h', type: 'hidden' }]));
      expect(h.wrappers).toEqual([]);
      expect(h.className).toBe('df-hidden-slot');
    });

    it('un tipo propio con wrappers: [] se pinta sin el wrapper del tema', () => {
      const formly: ConfigOption = { types: [{ name: 'panel', wrappers: [] }, { name: 'caja', wrappers: ['t-caja'] }] };
      const [p, c, i] = fieldsOf(setup({ formly }), schema([
        { key: 'p', type: 'panel' }, { key: 'c', type: 'caja' }, { key: 'i', type: 'text' },
      ]));
      expect(p.wrappers).toEqual([]);
      expect(c.wrappers).toEqual(['t-caja']);
      expect(i.wrappers).toEqual(['t-field']);
    });

    it('theme.typeWrappers sustituye a fieldWrappers para ese tipo del contrato', () => {
      const theme: DfTheme = { ...THEME, typeWrappers: { select: [] } };
      const [s, t] = fieldsOf(setup({ theme }), schema([{ key: 's', type: 'select', options: [] }, { key: 't', type: 'text' }]));
      expect(s.wrappers).toEqual([]);
      expect(t.wrappers).toEqual(['t-field']);
    });

    it('añade el validador email solo a los campos de tipo email', () => {
      const [e, t] = fieldsOf(setup(), schema([
        { key: 'e', type: 'email', validation: { validators: [{ name: 'par' }] } },
        { key: 't', type: 'text' },
      ]));
      type Expr = (c: FormControl) => boolean;
      const email = (e.validators as Record<string, { expression: Expr }>)['email'];
      expect(email.expression(new FormControl('a@b.es'))).toBe(true);
      expect(email.expression(new FormControl('a@'))).toBe(false);
      expect(email.expression(new FormControl(''))).toBe(true);
      expect(Object.keys(e.validators!)).toEqual(['email', 'par']);
      expect(t.validators).toBeUndefined();
    });

    describe('maxLength con peso', () => {
      type Val = (c: FormControl) => Record<string, unknown> | null;
      const pesado = (cfg: FormlyFieldConfig) => (cfg.validators as { validation?: Val[] } | undefined)?.validation?.[0];

      it('por defecto añade un validador donde la ñ y los acentos cuentan 2', () => {
        const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text', validation: { maxLength: 5 } }]));
        expect(a.props!['maxLengthMode']).toBe('weighted');
        const v = pesado(a)!;
        expect(v(new FormControl('abcde'))).toBeNull();
        expect(v(new FormControl('ñññ'))).toEqual({ maxLength: { requiredLength: 5, actualLength: 6 } });
        expect(v(new FormControl(null))).toBeNull();
      });

      it('con maxLengthMode chars en la config no lo añade', () => {
        const [a] = fieldsOf(setup({ maxLengthMode: 'chars' }), schema([{ key: 'a', type: 'text', validation: { maxLength: 5 } }]));
        expect(a.props!['maxLengthMode']).toBe('chars');
        expect(pesado(a)).toBeUndefined();
      });

      it('props.maxLengthMode del campo manda sobre la config', () => {
        const [a, b] = fieldsOf(setup({ maxLengthMode: 'chars' }), schema([
          { key: 'a', type: 'text', validation: { maxLength: 5 }, props: { maxLengthMode: 'weighted' } },
          { key: 'b', type: 'text', validation: { maxLength: 5 } },
        ]));
        expect(pesado(a)).toBeDefined();
        expect(pesado(b)).toBeUndefined();
      });

      it('convive con los alias del campo', () => {
        const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text', validation: { maxLength: 5, validators: [{ name: 'par' }] } }]));
        expect(Object.keys(a.validators!)).toEqual(['par', 'validation']);
      });

      it('sin maxLength no añade nada', () => {
        const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text' }]));
        expect(a.validators).toBeUndefined();
      });
    });

    describe('props de moneda', () => {
      const props = (cfg: FormlyFieldConfig) => {
        const { currency, numberFormat, wordsLanguage, amountInWords, wordsUppercase } = cfg.props!;
        return { currency, numberFormat, wordsLanguage, amountInWords, wordsUppercase };
      };

      it('sin props usa la config de la app', () => {
        const [i] = fieldsOf(setup({ currency: { code: 'GBP', numberFormat: 'en', wordsLanguage: 'en' } }), schema([{ key: 'i', type: 'currency' }]));
        expect(props(i)).toEqual({ currency: 'GBP', numberFormat: 'en', wordsLanguage: 'en', amountInWords: true, wordsUppercase: true });
      });

      it('las props válidas del campo mandan; el idioma sigue al formato del campo', () => {
        const [i] = fieldsOf(setup(), schema([{ key: 'i', type: 'currency', props: { currency: 'USD', numberFormat: 'en', wordsUppercase: false } }]));
        expect(props(i)).toEqual({ currency: 'USD', numberFormat: 'en', wordsLanguage: 'en', amountInWords: true, wordsUppercase: false });
      });

      it('ignora props no válidas (modo no estricto) y usa la config', () => {
        const svc = setup({ strictSchema: false });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const [i] = fieldsOf(svc, schema([{ key: 'i', type: 'currency', props: { currency: 'EURO', numberFormat: 'fr' } }]));
        expect(props(i)).toEqual({ currency: 'EUR', numberFormat: 'es', wordsLanguage: 'es', amountInWords: true, wordsUppercase: true });
      });

      it('los validadores usan el formato del campo', () => {
        const [i] = fieldsOf(setup(), schema([{ key: 'i', type: 'currency', props: { numberFormat: 'en', currency: 'GBP' } }]));
        type Expr = (c: FormControl) => boolean;
        const fmt = (i.validators as Record<string, { expression: Expr }>)['currencyFormat'];
        expect(fmt.expression(new FormControl('£1,500.75'))).toBe(true);
        expect(fmt.expression(new FormControl('1.500,75'))).toBe(false);
      });

      it('solo los campos currency reciben estas props', () => {
        const [t] = fieldsOf(setup(), schema([{ key: 't', type: 'text' }]));
        expect(t.props!['numberFormat']).toBeUndefined();
      });
    });

    it('hidden: true oculta el campo de forma estática', () => {
      const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text', hidden: true }]));
      expect(a.hide).toBe(true);
    });

    it('pasa los mensajes por campo a validation.messages resolviendo {{x}} con props y args', () => {
      const [a] = fieldsOf(setup(), schema([{
        key: 'a', type: 'number', label: 'Edad',
        validation: {
          min: 18, validators: [{ name: 'minimo', args: { min: 5 } }],
          messages: { required: 'Falta', min: '{{label}} mínima: {{min}}', minimo: 'Al menos {{min}}' },
        },
      }]));
      type Msg = (e: unknown, f: FormlyFieldConfig) => string;
      const messages = a.validation!.messages as Record<string, Msg>;
      expect(messages['required'](null, a)).toBe('Falta');
      expect(messages['min'](null, a)).toBe('Edad mínima: 18');
      expect(messages['minimo'](null, a)).toBe('Al menos 5');
    });
  });

  describe('sanitización', () => {
    it('elimina caracteres de control y espacios de los textos', () => {
      const clean = setup().sanitize(schema([{ key: 'a', type: 'text', label: '  Nom\u0000bre\u0007 ' }], { title: '\u001FTítulo' }));
      expect((clean.fields[0] as { label?: string }).label).toBe('Nombre');
      expect(clean.title).toBe('Título');
    });

    it('solo acepta booleanos true reales en readonly, disabled y hidden', () => {
      const raw = JSON.parse('{"key":"a","type":"text","readonly":"true","disabled":1,"hidden":true}');
      const [a] = fieldsOf(setup(), schema([raw]));
      expect(a.props!['readonly']).toBe(false);
      expect(a.props!['disabled']).toBe(false);
      expect(a.hide).toBe(true);
    });

    it('filtra props peligrosas: on*, __proto__, constructor, funciones y claves inválidas', () => {
      const props = JSON.parse('{"__proto__":{"polluted":true},"constructor":"x","onClick":"alert(1)","onclick":"alert(2)","ONLOAD":"x","data-x":1,"rows":3}');
      props.fn = () => 'malo';
      const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text', props }]));
      expect(a.props!['rows']).toBe(3);
      ['onClick', 'onclick', 'ONLOAD', 'data-x', 'fn', 'constructor'].forEach((k) => expect(Object.keys(a.props!)).not.toContain(k));
      expect(Object.prototype.hasOwnProperty.call(a.props, '__proto__')).toBe(false);
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });

    it('descarta claves desconocidas del nodo y no muta el esquema original', () => {
      const original = schema([{ key: 'a', type: 'text', label: ' A ', extra: 'x' } as DfNode]);
      const clean = setup().sanitize(original);
      expect(Object.keys(clean.fields[0])).not.toContain('extra');
      expect((original.fields[0] as { label?: string }).label).toBe(' A ');
    });
  });

  describe('validadores por alias', () => {
    const control = (value: unknown) => new FormControl(value);
    type Expr = (c: FormControl, f: FormlyFieldConfig) => unknown;
    type Msg = (e: unknown, f: FormlyFieldConfig) => string;
    const v = (cfg: FormlyFieldConfig, name: string, async = false) =>
      (async ? cfg.asyncValidators : cfg.validators)![name] as { expression: Expr; message: Msg };

    it('ejecuta el validador del registro con sus args', () => {
      const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'number', validation: { validators: [{ name: 'minimo', args: { min: 5 } }] } }]));
      expect(v(a, 'minimo').expression(control(7), a)).toBe(true);
      expect(v(a, 'minimo').expression(control(3), a)).toBe(false);
    });

    it('interpola el mensaje con props del campo y args', () => {
      const [a] = fieldsOf(setup(), schema([
        { key: 'a', type: 'number', label: 'Cantidad', validation: { validators: [{ name: 'minimo', args: { min: 5 } }] } },
      ]));
      expect(v(a, 'minimo').message(null, a)).toBe('Mínimo 5 en Cantidad');
    });

    it('el mensaje del esquema sustituye al del registro', () => {
      const [a] = fieldsOf(setup(), schema([
        { key: 'a', type: 'number', validation: { validators: [{ name: 'par', message: 'Impar: {{ x }}{{nada}}', args: { x: 1 } }] } },
      ]));
      expect(v(a, 'par').message(null, a)).toBe('Impar: 1');
    });

    it('admite mensajes como función', () => {
      const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text', validation: { validators: [{ name: 'fn', args: { x: 'y' } }] } }]));
      expect(v(a, 'fn').message(null, a)).toBe('fn:y');
    });

    it('registra los async en asyncValidators', async () => {
      const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text', validation: { asyncValidators: [{ name: 'remoto' }] } }]));
      expect(a.validators).toBeUndefined();
      const result = v(a, 'remoto', true).expression(control('x'), a) as Observable<boolean>;
      expect(await firstValueFrom(result)).toBe(true);
    });

    it('avisa y omite los validadores en la lista equivocada', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const [a] = fieldsOf(setup(), schema([{
        key: 'a', type: 'text', validation: { validators: [{ name: 'remoto' }], asyncValidators: [{ name: 'par' }] },
      }]));
      expect(a.validators).toEqual({});
      expect(a.asyncValidators).toEqual({});
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[0][0]).toContain('"remoto" es async');
    });
  });

  describe('opciones', () => {
    const OPTS: DfOption[] = [{ value: 'a', label: 'A' }];

    it('array y static se asignan directamente', () => {
      const [a, b] = fieldsOf(setup(), schema([
        { key: 'a', type: 'select', options: OPTS },
        { key: 'b', type: 'select', options: { source: 'static', items: OPTS } },
      ]));
      expect(a.props!['options']).toBe(OPTS);
      expect(b.props!['options']).toBe(OPTS);
      expect(a.expressions).toBeUndefined();
      expect(a.hooks).toBeUndefined();
    });

    describe('dependent', () => {
      const deps = (resetOnChange?: boolean) => fieldsOf(setup(), schema([
        { key: 'dir.provincia', type: 'select', options: [] },
        {
          key: 'municipio', type: 'select',
          options: { source: 'dependent', dependsOn: 'dir.provincia', map: { '28': OPTS }, resetOnChange },
        },
      ]))[1];

      it('resuelve las opciones según el valor del padre en el modelo raíz', () => {
        const m = deps();
        expect(m.props!['options']).toEqual([]);
        expect(expr(m, 'props.options', { dir: { provincia: 28 } })).toBe(OPTS);
        expect(expr(m, 'props.options', { dir: { provincia: '08' } })).toEqual([]);
        expect(expr(m, 'props.options', {})).toEqual([]);
      });

      it('vacía el hijo cuando cambia el padre y se desuscribe al destruir', () => {
        const m = deps();
        const form = new FormGroup({
          dir: new FormGroup({ provincia: new FormControl('28') }),
          municipio: new FormControl<string | null>('m1'),
        });
        const provincia = form.get('dir.provincia')!;
        const field = { formControl: form.get('municipio') } as FormlyFieldConfig;
        m.hooks!.onInit!(field);

        provincia.setValue('08');
        expect(form.value.municipio).toBeNull();

        form.get('municipio')!.setValue('m2');
        provincia.setValue('08');
        expect(form.value.municipio, 'distinctUntilChanged').toBe('m2');

        m.hooks!.onDestroy!(field);
        provincia.setValue('41');
        expect(form.value.municipio).toBe('m2');
      });

      it('sin map (esquema inválido en modo no estricto) no rompe: devuelve []', () => {
        const svc = setup({ strictSchema: false });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const [, m] = fieldsOf(svc, schema([
          { key: 'p', type: 'select', options: [] },
          { key: 'm', type: 'select', options: { source: 'dependent', dependsOn: 'p' } as never },
        ]));
        expect(expr(m, 'props.options', { p: '28' })).toEqual([]);
      });

      it('resetOnChange: false no engancha hooks', () => {
        expect(deps(false).hooks).toBeUndefined();
      });
    });

    describe('remote', () => {
      const remoteField = (svc: FormSchemaAdapterService) => fieldsOf(svc, schema([
        { key: 'provincia', type: 'select', options: [] },
        { key: 'calle', type: 'select', options: { source: 'remote', endpoint: '/calles', dependsOn: ['provincia'] } },
      ]))[1];

      it('carga vía DF_OPTIONS_PROVIDER con los params de dependsOn y cachea', async () => {
        const provider = { load: vi.fn().mockReturnValue(of(OPTS)) };
        const c = remoteField(setup({ optionsProvider: provider }));

        expect(await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', { provincia: '28' }))).toBe(OPTS);
        await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', { provincia: '28' }));
        expect(provider.load).toHaveBeenCalledExactlyOnceWith('/calles', { provincia: '28' });

        await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', { provincia: '08' }));
        expect(provider.load).toHaveBeenCalledTimes(2);
      });

      it('registerOptionsProvider() registra uno en tiempo de ejecución y vacía la caché', async () => {
        const first = { load: vi.fn().mockReturnValue(of(OPTS)) };
        const second = { load: vi.fn().mockReturnValue(of([])) };
        const svc = setup();
        const c = remoteField(svc);
        svc.registerOptionsProvider(first);
        expect(await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', { provincia: '28' }))).toBe(OPTS);
        svc.registerOptionsProvider(second);
        expect(await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', { provincia: '28' }))).toEqual([]);
        expect(first.load).toHaveBeenCalledTimes(1);
        expect(second.load).toHaveBeenCalledExactlyOnceWith('/calles', { provincia: '28' });
      });

      it('no llama al provider mientras falte algún padre', async () => {
        const provider = { load: vi.fn().mockReturnValue(of(OPTS)) };
        const c = remoteField(setup({ optionsProvider: provider }));
        expect(await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', { provincia: '' }))).toEqual([]);
        expect(provider.load).not.toHaveBeenCalled();
      });

      it('sin provider registrado avisa y devuelve []', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const c = remoteField(setup());
        expect(await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', { provincia: '28' }))).toEqual([]);
        expect(warn.mock.lastCall![0]).toContain('sin DF_OPTIONS_PROVIDER');
      });

      it('sin endpoint (modo no estricto) devuelve [] sin llamar al provider', async () => {
        const provider = { load: vi.fn().mockReturnValue(of(OPTS)) };
        const svc = setup({ strictSchema: false, optionsProvider: provider });
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const [c] = fieldsOf(svc, schema([{ key: 'c', type: 'select', options: { source: 'remote' } as never }]));
        expect(await firstValueFrom(expr<Observable<DfOption[]>>(c, 'props.options', {}))).toEqual([]);
        expect(provider.load).not.toHaveBeenCalled();
      });

      it('sin dependsOn no engancha hooks', () => {
        const [c] = fieldsOf(setup(), schema([{ key: 'c', type: 'select', options: { source: 'remote', endpoint: '/x' } }]));
        expect(c.hooks).toBeUndefined();
      });
    });
  });

  describe('layout.resetOnHide', () => {
    const nodes: DfNode[] = [
      { key: 'a', type: 'text' },
      { key: 'b', type: 'text', logic: { resetOnHide: true } },
      { type: 'group', id: 'g', fields: [{ key: 'c', type: 'text' }] },
    ];
    const reset = (svc: FormSchemaAdapterService, layout?: DfFormSchema['layout']) => {
      const [a, b, g] = fieldsOf(svc, schema(nodes, { layout }));
      return [a.resetOnHide, b.resetOnHide, g.resetOnHide, g.fieldGroup![0].resetOnHide];
    };

    it('sin layout.resetOnHide manda defaultResetOnHide de la app', () => {
      expect(reset(setup({ defaultResetOnHide: false }))).toEqual([false, true, false, false]);
    });

    it('layout.resetOnHide sustituye al de la app, y el logic.resetOnHide del nodo a ambos', () => {
      expect(reset(setup({ defaultResetOnHide: true }), { resetOnHide: false })).toEqual([false, true, false, false]);
    });

    it('layout.resetOnHide: true también vale cuando la app lo desactiva', () => {
      expect(reset(setup({ defaultResetOnHide: false }), { resetOnHide: true })).toEqual([true, true, true, true]);
    });

    it('no se arrastra al siguiente esquema', () => {
      const svc = setup({ defaultResetOnHide: true });
      reset(svc, { resetOnHide: false });
      expect(reset(svc)).toEqual([true, true, true, true]);
    });
  });

  describe('lógica condicional', () => {
    const tipo = { key: 'tipo', type: 'text' } as const;
    const esEmpresa = { field: 'tipo', operator: 'eq', value: 'empresa' } as const;
    const esBaja = { field: 'tipo', operator: 'eq', value: 'baja' } as const;

    it('showWhen oculta cuando la regla no se cumple', () => {
      const [, cif] = fieldsOf(setup(), schema([tipo, { key: 'cif', type: 'text', logic: { showWhen: esEmpresa } }]));
      expect(expr(cif, 'hide', { tipo: 'empresa' })).toBe(false);
      expect(expr(cif, 'hide', { tipo: 'particular' })).toBe(true);
    });

    it('hideWhen tiene prioridad sobre showWhen', () => {
      const [, a] = fieldsOf(setup(), schema([tipo, {
        key: 'a', type: 'text', logic: { showWhen: { any: [esEmpresa, esBaja] }, hideWhen: esBaja },
      }]));
      expect(expr(a, 'hide', { tipo: 'empresa' })).toBe(false);
      expect(expr(a, 'hide', { tipo: 'baja' })).toBe(true);
      expect(expr(a, 'hide', { tipo: 'otro' })).toBe(true);
    });

    it('hidden: true gana a cualquier regla', () => {
      const [, a] = fieldsOf(setup(), schema([tipo, { key: 'a', type: 'text', hidden: true, logic: { showWhen: esEmpresa } }]));
      expect(expr(a, 'hide', { tipo: 'empresa' })).toBe(true);
    });

    it('requiredWhen y disabledWhen se suman al valor estático', () => {
      const [, a, b] = fieldsOf(setup(), schema([
        tipo,
        { key: 'a', type: 'text', logic: { requiredWhen: esEmpresa, disabledWhen: esBaja } },
        { key: 'b', type: 'text', disabled: true, validation: { required: true }, logic: { requiredWhen: esEmpresa, disabledWhen: esBaja } },
      ]));
      expect(expr(a, 'props.required', { tipo: 'empresa' })).toBe(true);
      expect(expr(a, 'props.required', { tipo: 'otro' })).toBe(false);
      expect(expr(a, 'props.disabled', { tipo: 'baja' })).toBe(true);
      expect(expr(a, 'props.disabled', { tipo: 'otro' })).toBe(false);
      expect(expr(b, 'props.required', { tipo: 'otro' })).toBe(true);
      expect(expr(b, 'props.disabled', { tipo: 'otro' })).toBe(true);
    });

    it('aplica la lógica también a los grupos, contra el modelo raíz', () => {
      const [, g] = fieldsOf(setup(), schema([
        tipo,
        { type: 'group', id: 'empresa', logic: { showWhen: esEmpresa }, fields: [{ key: 'cif', type: 'text' }] },
      ]));
      expect(expr(g, 'hide', { tipo: 'empresa' })).toBe(false);
      expect(expr(g, 'hide', { tipo: 'otro' })).toBe(true);
    });

    it('resetOnHide sale de la lógica o del valor por defecto de la config', () => {
      const svc = setup({ defaultResetOnHide: false });
      const [, a, b] = fieldsOf(svc, schema([
        tipo,
        { key: 'a', type: 'text' },
        { key: 'b', type: 'text', logic: { showWhen: esEmpresa, resetOnHide: true } },
      ]));
      expect(a.resetOnHide).toBe(false);
      expect(b.resetOnHide).toBe(true);
    });

    it('sin lógica no crea expressions', () => {
      const [a] = fieldsOf(setup(), schema([{ key: 'a', type: 'text' }]));
      expect(a.expressions).toBeUndefined();
    });
  });

  describe('listas repetibles (array)', () => {
    const lista = (extra: Record<string, unknown> = {}, fields: DfNode[] = [{ key: 'a', type: 'text', label: 'A' }]) =>
      ({ type: 'array', key: 'lineas', fields, ...extra }) as DfNode;

    it('se mapea a un df-repeat con fieldArray, límites y defaultValue de minItems', () => {
      const [l] = fieldsOf(setup(), schema([lista({ minItems: 2, maxItems: 4, title: 'Líneas', itemLabel: 'Línea', columns: 2 })]));
      expect(l.key).toBe('lineas');
      expect(l.type).toBe('df-repeat');
      expect(l.className).toContain('df-col-12');
      expect(l.defaultValue).toEqual([{}, {}]);
      expect(l.props).toMatchObject({ label: 'Líneas', itemLabel: 'Línea', minItems: 2, maxItems: 4, display: 'rows' });
      expect(l.fieldArray).toMatchObject({ fieldGroupClassName: 'df-grid df-grid--2' });
      expect((l.fieldArray as FormlyFieldConfig).fieldGroup![0].key).toBe('a');
    });

    it('sin minItems no hay filas iniciales', () => {
      const [l] = fieldsOf(setup(), schema([lista()]));
      expect(l.defaultValue).toBeUndefined();
    });

    it('minItems y maxItems son validadores del array', () => {
      const [l] = fieldsOf(setup(), schema([lista({ minItems: 2, maxItems: 3 })]));
      const validators = l.validators as Record<string, { expression: (c: FormControl) => boolean }>;
      const with_ = (n: number) => new FormControl(Array.from({ length: n }, () => ({})));
      expect(validators['minItems'].expression(with_(1))).toBe(false);
      expect(validators['minItems'].expression(with_(2))).toBe(true);
      expect(validators['maxItems'].expression(with_(3))).toBe(true);
      expect(validators['maxItems'].expression(with_(4))).toBe(false);
    });

    it('en display "table" las celdas no llevan etiqueta ni clase de columna y se calculan las cabeceras', () => {
      const [l] = fieldsOf(setup(), schema([lista({ display: 'table' }, [
        { key: 'a', type: 'text', label: 'A', layout: { col: 6, cssClass: 'mia' }, validation: { required: true } },
        { key: 'h', type: 'hidden' },
        { key: 'b', type: 'number', label: 'B' },
      ])]));
      expect(l.props!['display']).toBe('table');
      expect(l.props!['tableColumns']).toEqual([
        { label: 'A', col: 6, required: true },
        { label: 'B', col: 1, required: false },
      ]);
      const cells = (l.fieldArray as FormlyFieldConfig).fieldGroup!;
      expect((l.fieldArray as FormlyFieldConfig).fieldGroupClassName).toBe('df-table-row');
      expect(cells[0].className).toBe('mia');
      expect(cells[0].props).toMatchObject({ hideLabel: true, attributes: { 'aria-label': 'A' } });
    });

    it('resuelve los totales con la moneda y el formato del campo sumado', () => {
      const [l] = fieldsOf(setup(), schema([lista({
        totals: [
          { label: 'Filas', op: 'count' },
          { label: 'Libras', op: 'sum', field: 'precio' },
          { label: 'Uds', op: 'sum', field: 'uds' },
        ],
      }, [
        { key: 'precio', type: 'currency', props: { currency: 'GBP', numberFormat: 'en' } },
        { key: 'uds', type: 'number' },
      ])]));
      expect(l.props!['totals']).toEqual([
        { label: 'Filas', op: 'count', field: undefined, numberFormat: 'es' },
        { label: 'Libras', op: 'sum', field: 'precio', currency: 'GBP', numberFormat: 'en' },
        { label: 'Uds', op: 'sum', field: 'uds', numberFormat: 'es' },
      ]);
    });

    it('las reglas dentro de la lista leen ./campo del modelo de la fila y el resto de la raíz', () => {
      const [l] = fieldsOf(setup(), schema([
        lista({}, [
          { key: 'tipo', type: 'text' },
          {
            key: 'm', type: 'text',
            logic: { showWhen: { all: [{ field: './tipo', operator: 'eq', value: 'x' }, { field: 'global', operator: 'truthy' }] } },
          },
        ]),
        { key: 'global', type: 'checkbox' },
      ]));
      const cell = (l.fieldArray as FormlyFieldConfig).fieldGroup![1];
      const hide = cell.expressions!['hide'] as (f: FormlyFieldConfig) => boolean;
      const at = (row: unknown, root: unknown) => ({ model: row, parent: { parent: { model: root } } }) as FormlyFieldConfig;
      expect(hide(at({ tipo: 'x' }, { global: true }))).toBe(false);
      expect(hide(at({ tipo: 'y' }, { global: true }))).toBe(true);
      expect(hide(at({ tipo: 'x' }, { global: false }))).toBe(true);
    });

    it('un dependent con dependsOn "./campo" mira el modelo de la fila', () => {
      const [l] = fieldsOf(setup(), schema([lista({}, [
        { key: 'p', type: 'text' },
        { key: 'c', type: 'select', options: { source: 'dependent', dependsOn: './p', map: { M: [{ value: 'a', label: 'A' }] } } },
      ])]));
      const child = (l.fieldArray as FormlyFieldConfig).fieldGroup![1];
      const options = child.expressions!['props.options'] as (f: FormlyFieldConfig) => DfOption[];
      const at = (row: unknown) => ({ model: row, parent: { model: {} } }) as FormlyFieldConfig;
      expect(options(at({ p: 'M' }))).toEqual([{ value: 'a', label: 'A' }]);
      expect(options(at({ p: 'otra' }))).toEqual([]);
    });

    it('sanitiza los textos de la lista y los totales', () => {
      const clean = setup().sanitize(schema([lista({ title: ' Lí\u0000neas ', totals: [{ label: 'To\u0007tal', op: 'count' }] })]));
      const a = clean.fields[0] as unknown as { title: string; totals: { label: string }[] };
      expect(a.title).toBe('Líneas');
      expect(a.totals[0].label).toBe('Total');
    });
  });

  describe('tablas de datos (table)', () => {
    const tabla = (extra: Record<string, unknown> = {}) =>
      ({ type: 'table', id: 'clientes', columns: [{ key: 'nombre', label: 'Nombre' }], ...extra }) as DfNode;

    it('se mapea a un df-table sin key, con las columnas resueltas', () => {
      const [t] = fieldsOf(setup(), schema([tabla({
        title: 'Clientes', filter: true, pageSize: 5, selectable: true, rows: [{ nombre: 'Ana' }],
        columns: [
          { key: 'nombre', label: 'Nombre', col: 4 },
          { key: 'importe', label: 'Importe', type: 'currency', currency: 'GBP', sortable: false },
        ],
        actions: [{ name: 'editar', label: 'Editar' }],
      })]));
      expect(t.key).toBeUndefined();
      expect(t.type).toBe('df-table');
      expect(t.className).toContain('df-col-12');
      expect(t.props).toMatchObject({
        tableId: 'clientes', title: 'Clientes', filter: true, pageSize: 5, selectable: true,
        staticRows: [{ nombre: 'Ana' }], actions: [{ name: 'editar', label: 'Editar' }],
      });
      expect(t.props!['columns']).toEqual([
        { key: 'nombre', label: 'Nombre', type: 'text', map: undefined, sortable: true, col: 4, currency: 'EUR', numberFormat: 'es', filter: false, frozen: false, html: false },
        { key: 'importe', label: 'Importe', type: 'currency', map: undefined, sortable: false, col: 1, currency: 'GBP', numberFormat: 'es', filter: false, frozen: false, html: false },
      ]);
    });

    it('source llega a las props con el modo por defecto client y sin dependsOn', () => {
      const svc = setup();
      const [a, b, , sinSource] = fieldsOf(svc, schema([
        tabla({ source: { endpoint: '/api/x' }, errorMessage: 'Mal' }),
        tabla({ id: 'otra', source: { endpoint: '/api/y', mode: 'server', dependsOn: ['q'] }, pageSize: 5 }),
        { key: 'q', type: 'text' },
        tabla({ id: 'local' }),
      ]));
      expect(a.props!['source']).toEqual({ endpoint: '/api/x', mode: 'client', dependsOn: [] });
      expect(a.props!['errorMessage']).toBe('Mal');
      expect(b.props!['source']).toEqual({ endpoint: '/api/y', mode: 'server', dependsOn: ['q'] });
      expect(sinSource.props!['source']).toBeUndefined();
    });

    it('la lógica condicional se aplica como en los grupos', () => {
      const [t] = fieldsOf(setup(), schema([tabla({ logic: { showWhen: { field: 'ver', operator: 'truthy' } } }), { key: 'ver', type: 'checkbox' }]));
      expect(expr<boolean>(t, 'hide', { ver: false })).toBe(true);
      expect(expr<boolean>(t, 'hide', { ver: true })).toBe(false);
    });

    it('sanitiza textos, filas y mapas: sin caracteres de control, __proto__ ni funciones', () => {
      const rows = JSON.parse('[{"nombre":"A\\u0000na","__proto__":{"polluted":true},"anidado":{"x":"y\\u0007"}}]');
      rows[0].fn = () => 'malo';
      const clean = setup().sanitize(schema([tabla({
        title: ' Cli\u0000entes ', emptyMessage: 'Va\u0007cío', rows,
        columns: [{ key: 'n', label: 'Nom\u0000bre', type: 'map', map: JSON.parse('{"A":"Al\\u0000ta","__proto__":{"x":1}}') }],
        actions: [{ name: 'a', label: 'Ed\u0000itar' }],
      })]));
      const t = clean.fields[0] as unknown as {
        title: string; emptyMessage: string; rows: Record<string, unknown>[];
        columns: { label: string; map: Record<string, string> }[]; actions: { label: string }[];
      };
      expect(t.title).toBe('Clientes');
      expect(t.emptyMessage).toBe('Vacío');
      expect(t.columns[0].label).toBe('Nombre');
      expect(t.columns[0].map['A']).toBe('Alta');
      expect(Object.prototype.hasOwnProperty.call(t.columns[0].map, '__proto__')).toBe(false);
      expect(t.actions[0].label).toBe('Editar');
      expect(t.rows[0]['nombre']).toBe('Ana');
      expect(t.rows[0]['anidado']).toEqual({ x: 'y' });
      expect(Object.keys(t.rows[0])).not.toContain('fn');
      expect(Object.prototype.hasOwnProperty.call(t.rows[0], '__proto__')).toBe(false);
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
  });
});
