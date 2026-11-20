import { renderForm } from '../../testing/render-form';

const NBSP = '\u00a0';

describe('CurrencyFieldComponent (df-currency)', () => {
  const importe = { key: 'importe', type: 'currency', label: 'Importe' } as const;

  /** Escribe como el usuario: entra en el campo, teclea y sale. */
  async function escribir(f: Awaited<ReturnType<typeof renderForm>>, texto: string): Promise<void> {
    const input = f.$<HTMLInputElement>('input')!;
    input.dispatchEvent(new Event('focus'));
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await f.stable();
  }

  it('guarda un number en el modelo y al salir formatea como moneda', async () => {
    const f = await renderForm([importe]);
    await escribir(f, '1500,75');
    expect(f.host.model).toEqual({ importe: 1500.75 });
    expect(f.$<HTMLInputElement>('input')!.value).toBe(`1.500,75${NBSP}€`);
  });

  it('acepta puntos de miles y el símbolo €', async () => {
    const f = await renderForm([importe]);
    await escribir(f, '1.500.000,5 €');
    expect(f.host.model['importe']).toBe(1500000.5);
  });

  it('al entrar en el campo muestra el importe editable, sin miles ni símbolo', async () => {
    const f = await renderForm([importe], { model: { importe: 1500.75 } });
    const input = f.$<HTMLInputElement>('input')!;
    expect(input.value).toBe(`1.500,75${NBSP}€`);
    input.dispatchEvent(new Event('focus'));
    expect(input.value).toBe('1500,75');
  });

  it('escribe el importe en letra debajo, en mayúsculas', async () => {
    const f = await renderForm([importe]);
    await escribir(f, '1250,5');
    const words = f.$('.df-currency__words')!;
    expect(words.textContent?.trim()).toBe('MIL DOSCIENTOS CINCUENTA EUROS CON CINCUENTA CÉNTIMOS');
    expect(f.$('input')!.getAttribute('aria-describedby')).toBe(words.id);
  });

  it('no escribe la letra si el campo está vacío o el importe no es válido', async () => {
    const f = await renderForm([importe]);
    expect(f.$('.df-currency__words')).toBeNull();
    await escribir(f, '12.12');
    expect(f.$('.df-currency__words')).toBeNull();
  });

  it('props: wordsUppercase=false, amountInWords=false y nombres de otra moneda', async () => {
    const f = await renderForm([
      { key: 'a', type: 'currency', props: { wordsUppercase: false } },
      { key: 'b', type: 'currency', props: { amountInWords: false } },
      {
        key: 'c', type: 'currency',
        props: { currency: 'USD', currencyWords: { singular: 'dólar', plural: 'dólares', centSingular: 'centavo', centPlural: 'centavos' } },
      },
      { key: 'd', type: 'currency', props: { currency: 'CHF' } },
    ], { model: { a: 1, b: 1, c: 1.5, d: 2 } });
    const words = f.$$('.df-currency__words').map((w) => w.textContent?.trim());
    expect(words, 'CHF no trae nombres: sin letra').toEqual(['un euro', 'UN DÓLAR CON CINCUENTA CENTAVOS']);
    expect(f.$$<HTMLInputElement>('input')[3].value).toBe(`2,00${NBSP}CHF`);
  });

  it('formato inválido: guarda el texto, lo mantiene en la caja y muestra el error', async () => {
    const f = await renderForm([importe]);
    await escribir(f, '12.12');
    expect(f.host.model['importe']).toBe('12.12');
    expect(f.$<HTMLInputElement>('input')!.value).toBe('12.12');
    expect(f.host.dynamicForm.valid).toBe(false);
    expect(f.$('.df-error')?.textContent?.trim()).toBe('El importe no tiene un formato válido (p. ej. 1.500,75)');
  });

  it('más de dos decimales: error de decimales', async () => {
    const f = await renderForm([importe]);
    await escribir(f, '10,555');
    expect(f.$('.df-error')?.textContent?.trim()).toBe('El importe no puede tener más de dos decimales');
  });

  it('vaciar el campo deja null y vale salvo que sea obligatorio', async () => {
    const f = await renderForm([{ ...importe, validation: { required: true } }], { model: { importe: 5 } });
    await escribir(f, '');
    expect(f.host.model['importe']).toBeNull();
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Este campo es obligatorio');
  });

  it('aplica min y max sobre el número', async () => {
    const f = await renderForm([{ ...importe, validation: { min: 10, max: 5000 } }]);
    await escribir(f, '9000');
    expect(f.$('.df-error')?.textContent?.trim()).toBe('El valor máximo es 5000');
    await escribir(f, '5,5');
    expect(f.$('.df-error')?.textContent?.trim()).toBe('El valor mínimo es 10');
    await escribir(f, '100');
    expect(f.$('.df-error')).toBeNull();
  });

  it('refleja cambios del modelo hechos desde fuera (reset)', async () => {
    const f = await renderForm([importe], { model: { importe: 1 } });
    f.host.dynamicForm.reset({ importe: 2500 });
    await f.stable();
    expect(f.$<HTMLInputElement>('input')!.value).toBe(`2.500,00${NBSP}€`);
    expect(f.$('.df-currency__words')?.textContent?.trim()).toBe('DOS MIL QUINIENTOS EUROS');
  });

  it('respeta disabled, readonly y placeholder', async () => {
    const f = await renderForm([
      { key: 'a', type: 'currency', disabled: true },
      { key: 'b', type: 'currency', readonly: true, placeholder: '0,00 €' },
    ]);
    const [a, b] = f.$$<HTMLInputElement>('input');
    expect(a.disabled).toBe(true);
    expect(b.readOnly).toBe(true);
    expect(b.placeholder).toBe('0,00 €');
    expect(b.getAttribute('inputmode')).toBe('decimal');
  });

  it('la label del wrapper apunta al input', async () => {
    const f = await renderForm([importe]);
    expect(f.$<HTMLLabelElement>('.df-label')!.htmlFor).toBe(f.$('input')!.id);
  });

  describe('moneda y formato configurables', () => {
    const libras = { key: 'importe', type: 'currency', label: 'Amount', props: { currency: 'GBP', numberFormat: 'en' } } as const;

    it('libras en formato inglés: lee 1,500.75, muestra £1,500.75 y escribe la letra en inglés', async () => {
      const f = await renderForm([libras]);
      await escribir(f, '1,500.75');
      expect(f.host.model['importe']).toBe(1500.75);
      expect(f.$<HTMLInputElement>('input')!.value).toBe('£1,500.75');
      expect(f.$('.df-currency__words')?.textContent?.trim()).toBe('ONE THOUSAND FIVE HUNDRED POUNDS AND SEVENTY-FIVE PENCE');
      f.$('input')!.dispatchEvent(new Event('focus'));
      expect(f.$<HTMLInputElement>('input')!.value).toBe('1500.75');
    });

    it('en formato inglés rechaza el formato español con el ejemplo del formato del campo', async () => {
      const f = await renderForm([libras]);
      await escribir(f, '1.500,75');
      expect(f.$('.df-error')?.textContent?.trim()).toBe('El importe no tiene un formato válido (p. ej. 1,500.75)');
    });

    it('libras con formato español y letra en español (femenino)', async () => {
      const f = await renderForm([{ key: 'i', type: 'currency', props: { currency: 'GBP' } }]);
      await escribir(f, '21');
      expect(f.$<HTMLInputElement>('input')!.value).toBe(`21,00${NBSP}£`);
      expect(f.$('.df-currency__words')?.textContent?.trim()).toBe('VEINTIUNA LIBRAS');
    });

    it('wordsLanguage del campo manda sobre el numberFormat', async () => {
      const f = await renderForm([{ key: 'i', type: 'currency', props: { currency: 'GBP', numberFormat: 'en', wordsLanguage: 'es' } }], { model: { i: 200 } });
      expect(f.$('.df-currency__words')?.textContent?.trim()).toBe('DOSCIENTAS LIBRAS');
    });

    it('provideDynamicForms({ currency }) fija los valores por defecto de la app', async () => {
      const f = await renderForm([{ key: 'i', type: 'currency' }], {
        model: { i: 5 },
        config: { currency: { code: 'GBP', numberFormat: 'en', wordsUppercase: false } },
      });
      expect(f.$<HTMLInputElement>('input')!.value).toBe('£5.00');
      expect(f.$('.df-currency__words')?.textContent?.trim()).toBe('five pounds');
    });

    it('las props del campo mandan sobre la config de la app', async () => {
      const f = await renderForm([{ key: 'i', type: 'currency', props: { currency: 'EUR', numberFormat: 'es' } }], {
        model: { i: 5 },
        config: { currency: { code: 'GBP', numberFormat: 'en' } },
      });
      expect(f.$<HTMLInputElement>('input')!.value).toBe(`5,00${NBSP}€`);
      expect(f.$('.df-currency__words')?.textContent?.trim()).toBe('CINCO EUROS');
    });

    it('una config de moneda no válida falla al arrancar', async () => {
      await expect(renderForm([{ key: 'i', type: 'currency' }], { config: { currency: { code: 'EURO' } } }))
        .rejects.toThrow(/currency.code/);
    });
  });
});
