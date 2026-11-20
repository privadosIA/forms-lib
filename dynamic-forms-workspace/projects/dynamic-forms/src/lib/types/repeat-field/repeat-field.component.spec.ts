import { formSchema, renderForm } from '../../testing/render-form';
import { DfNode } from '../../models/schema.model';

const lineas = (extra: Record<string, unknown> = {}, fields?: DfNode[]): DfNode =>
  ({
    type: 'array',
    key: 'lineas',
    title: 'Líneas',
    itemLabel: 'Línea',
    fields: fields ?? [
      { key: 'concepto', type: 'text', label: 'Concepto', validation: { required: true } },
      { key: 'cantidad', type: 'number', label: 'Cantidad' },
    ],
    ...extra,
  }) as DfNode;

describe('RepeatFieldComponent (df-repeat)', () => {
  it('pinta una fila por elemento del modelo, con su título', async () => {
    const f = await renderForm([lineas()], { model: { lineas: [{ concepto: 'A' }, { concepto: 'B' }] } });
    expect(f.$$('.df-repeat__row')).toHaveLength(2);
    expect(f.$$('.df-repeat__row-title').map((e) => e.textContent?.trim())).toEqual(['Línea 1', 'Línea 2']);
    expect(f.$$<HTMLInputElement>('input[type=text]').map((i) => i.value)).toEqual(['A', 'B']);
  });

  it('añade y quita filas, y el modelo guarda un objeto por fila', async () => {
    const f = await renderForm([lineas()]);
    await f.click('.df-repeat__add');
    await f.click('.df-repeat__add');
    expect(f.$$('.df-repeat__row')).toHaveLength(2);

    const inputs = f.$$<HTMLInputElement>('input[type=text]');
    inputs[0].value = 'Uno'; inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = 'Dos'; inputs[1].dispatchEvent(new Event('input'));
    await f.stable();
    await f.submit();
    expect(f.host.submitted[0].model).toEqual({ lineas: [{ concepto: 'Uno' }, { concepto: 'Dos' }] });

    await f.click('.df-repeat__row .df-repeat__remove');
    expect(f.$$('.df-repeat__row')).toHaveLength(1);
    expect(f.$<HTMLInputElement>('input[type=text]')!.value).toBe('Dos');
  });

  it('minItems crea las filas iniciales y bloquea quitar; maxItems bloquea añadir', async () => {
    const f = await renderForm([lineas({ minItems: 1, maxItems: 2 })]);
    expect(f.$$('.df-repeat__row')).toHaveLength(1);
    expect(f.$<HTMLButtonElement>('.df-repeat__remove')!.disabled).toBe(true);

    await f.click('.df-repeat__add');
    expect(f.$$('.df-repeat__row')).toHaveLength(2);
    expect(f.$<HTMLButtonElement>('.df-repeat__add')!.disabled).toBe(true);
    expect(f.$<HTMLButtonElement>('.df-repeat__remove')!.disabled).toBe(false);
  });

  it('valida los campos de cada fila y no envía si alguna es inválida', async () => {
    const f = await renderForm([lineas()], { model: { lineas: [{ concepto: 'A' }, {}] } });
    await f.submit();
    expect(f.host.submitted).toHaveLength(0);
    expect(f.host.invalidSubmitted).toHaveLength(1);
    expect(f.$$('.df-repeat__row')[1].querySelector('.df-error')?.textContent).toContain('obligatorio');
  });

  it('avisa y no envía si hay menos filas que minItems', async () => {
    const f = await renderForm([lineas({ minItems: 2 })], { model: { lineas: [{ concepto: 'A' }] } });
    await f.submit();
    expect(f.host.submitted).toHaveLength(0);
    expect(f.$('.df-repeat__error')?.textContent).toContain('Añade al menos 2');
  });

  it('avisa y no envía si hay más filas que maxItems', async () => {
    const f = await renderForm([lineas({ maxItems: 1 })], { model: { lineas: [{ concepto: 'A' }, { concepto: 'B' }] } });
    await f.submit();
    expect(f.host.submitted).toHaveLength(0);
    expect(f.$('.df-repeat__error')?.textContent).toContain('No puede haber más de 1');
  });

  it('una regla ./campo mira solo la fila propia', async () => {
    const f = await renderForm(
      [lineas({}, [
        { key: 'tipo', type: 'text', label: 'Tipo' },
        { key: 'motivo', type: 'text', label: 'Motivo', logic: { showWhen: { field: './tipo', operator: 'eq', value: 'otro' } } },
      ])],
      { model: { lineas: [{ tipo: 'otro' }, { tipo: 'normal' }] } },
    );
    const rows = f.$$('.df-repeat__row');
    expect(rows[0].querySelectorAll('input[type=text]')).toHaveLength(2);
    expect(rows[1].querySelectorAll('input[type=text]')).toHaveLength(1);

    const tipo2 = rows[1].querySelector<HTMLInputElement>('input[type=text]')!;
    tipo2.value = 'otro'; tipo2.dispatchEvent(new Event('input'));
    await f.stable();
    expect(f.$$('.df-repeat__row')[1].querySelectorAll('input[type=text]')).toHaveLength(2);
  });

  it('una regla con ruta absoluta sigue leyendo la raíz desde dentro de la fila', async () => {
    const f = await renderForm(
      [
        { key: 'conIva', type: 'checkbox', label: 'Con IVA' },
        lineas({}, [{ key: 'iva', type: 'number', label: 'IVA', logic: { showWhen: { field: 'conIva', operator: 'truthy' } } }]),
      ],
      { model: { conIva: true, lineas: [{ iva: 21 }] } },
    );
    expect(f.$('.df-repeat__row input[type=number]')).not.toBeNull();
  });

  it('en display "table" pinta cabecera de columnas y celdas sin etiqueta', async () => {
    const f = await renderForm([lineas({ display: 'table' })], { model: { lineas: [{ concepto: 'A' }, { concepto: 'B' }] } });
    expect(f.$('.df-repeat--table')).not.toBeNull();
    expect(f.$$('.df-repeat__th').map((e) => e.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Concepto *', 'Cantidad']);
    expect(f.$$('.df-repeat__row .df-label')).toHaveLength(0);
    expect(f.$<HTMLInputElement>('.df-repeat__row input')!.getAttribute('aria-label')).toBe('Concepto');
    expect(f.$<HTMLElement>('.df-repeat')!.style.getPropertyValue('--df-table-cols')).toBe('minmax(0, 1fr) minmax(0, 1fr)');
  });

  it('usa el layout.col de cada campo como peso de la columna', async () => {
    const f = await renderForm([lineas({ display: 'table' }, [
      { key: 'a', type: 'text', label: 'A', layout: { col: 6 } },
      { key: 'b', type: 'text', label: 'B', layout: { col: 2 } },
    ])], { model: { lineas: [{}] } });
    expect(f.$<HTMLElement>('.df-repeat')!.style.getPropertyValue('--df-table-cols')).toBe('minmax(0, 6fr) minmax(0, 2fr)');
  });

  it('una lista deshabilitada no ofrece añadir ni quitar', async () => {
    const f = await renderForm(
      [lineas({ logic: { disabledWhen: { field: 'cerrado', operator: 'truthy' } } }), { key: 'cerrado', type: 'checkbox' }],
      { model: { cerrado: true, lineas: [{ concepto: 'A' }] } },
    );
    expect(f.$('.df-repeat__add')).toBeNull();
    expect(f.$('.df-repeat__remove')).toBeNull();
  });

  it('el esquema completo se acepta (formSchema)', async () => {
    const f = await renderForm(formSchema([lineas({ display: 'table', minItems: 1 })]));
    expect(f.$$('.df-repeat__row')).toHaveLength(1);
  });

  describe('totales', () => {
    const conTotales = (): DfNode =>
      lineas({
        totals: [
          { label: 'Líneas', op: 'count' },
          { label: 'Unidades', op: 'sum', field: 'cantidad' },
          { label: 'Importe', op: 'sum', field: 'precio' },
          { label: 'Media', op: 'avg', field: 'precio' },
        ],
      }, [
        { key: 'cantidad', type: 'number', label: 'Cantidad' },
        { key: 'precio', type: 'currency', label: 'Precio' },
      ]);
    const texts = (f: { $$: (s: string) => HTMLElement[] }) =>
      f.$$('.df-repeat__total').map((e) => `${e.querySelector('dt')?.textContent} ${e.querySelector('dd')?.textContent}`.replace(/\s+/g, ' '));

    it('calcula y formatea los totales; el importe lleva la moneda del campo', async () => {
      const f = await renderForm([conTotales()], { model: { lineas: [{ cantidad: 2, precio: 1500.5 }, { cantidad: 3, precio: 100 }] } });
      expect(texts(f)).toEqual(['Líneas 2', 'Unidades 5', expect.stringMatching(/^Importe 1\.600,50\s€$/), expect.stringMatching(/^Media 800,25\s€$/)]);
    });

    it('se recalculan al escribir y al quitar filas', async () => {
      const f = await renderForm([conTotales()], { model: { lineas: [{ cantidad: 2 }, { cantidad: 3 }] } });
      expect(texts(f)[1]).toBe('Unidades 5');
      const inputs = f.$$<HTMLInputElement>('.df-repeat__row input[type=number]');
      inputs[0].value = '10'; inputs[0].dispatchEvent(new Event('input'));
      await f.stable();
      expect(texts(f)[1]).toBe('Unidades 13');
      await f.click('.df-repeat__row .df-repeat__remove');
      expect(texts(f)[1]).toBe('Unidades 3');
      expect(texts(f)[0]).toBe('Líneas 1');
    });

    it('sin valores, la media se muestra como guion y la suma como cero', async () => {
      const f = await renderForm([conTotales()], { model: { lineas: [{}] } });
      expect(texts(f)[1]).toBe('Unidades 0');
      expect(texts(f)[3]).toBe('Media —');
    });
  });

  it('un select dependent con dependsOn "./campo" mira la provincia de su propia fila y se vacía al cambiarla', async () => {
    const f = await renderForm([lineas({}, [
      { key: 'provincia', type: 'select', label: 'Provincia', options: [{ value: 'M', label: 'Madrid' }, { value: 'B', label: 'Barcelona' }] },
      {
        key: 'municipio', type: 'select', label: 'Municipio',
        options: { source: 'dependent', dependsOn: './provincia', map: { M: [{ value: 'a', label: 'Alcalá' }], B: [{ value: 'g', label: 'Girona' }] } },
      },
    ])], { model: { lineas: [{ provincia: 'M', municipio: 'a' }, { provincia: 'B' }] } });

    const rows = () => f.$$('.df-repeat__row');
    const optionsOf = (row: Element) => Array.from(row.querySelectorAll('select')[1].options).map((o) => o.textContent?.trim()).filter(Boolean);
    expect(optionsOf(rows()[0])).toContain('Alcalá');
    expect(optionsOf(rows()[1])).toContain('Girona');
    expect(optionsOf(rows()[1])).not.toContain('Alcalá');

    const provincia = rows()[0].querySelector('select')!;
    provincia.value = Array.from(provincia.options).find((o) => o.textContent?.trim() === 'Barcelona')!.value;
    provincia.dispatchEvent(new Event('change'));
    await f.stable();
    expect(optionsOf(rows()[0])).toContain('Girona');
    await f.submit();
    expect(f.host.model['lineas']).toEqual([{ provincia: 'B', municipio: null }, { provincia: 'B' }]);
  });
});
