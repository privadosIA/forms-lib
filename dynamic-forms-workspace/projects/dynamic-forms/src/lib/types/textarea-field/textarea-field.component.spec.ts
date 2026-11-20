import { renderForm } from '../../testing/render-form';

describe('TextareaFieldComponent (df-textarea)', () => {
  it('usa 3 filas por defecto y props.rows si viene', async () => {
    const f = await renderForm([{ key: 'a', type: 'textarea' }, { key: 'b', type: 'textarea', props: { rows: 6 } }]);
    expect(f.$$<HTMLTextAreaElement>('textarea').map((t) => t.rows)).toEqual([3, 6]);
  });

  it('enlaza el valor con el modelo', async () => {
    const f = await renderForm([{ key: 'obs', type: 'textarea' }], { model: { obs: 'hola' } });
    expect(f.$<HTMLTextAreaElement>('textarea')!.value).toBe('hola');
    await f.type('textarea', 'adiós');
    expect(f.host.model['obs']).toBe('adiós');
  });

  it('pinta maxlength y readonly', async () => {
    const f = await renderForm([{ key: 'a', type: 'textarea', readonly: true, validation: { maxLength: 200 } }]);
    const t = f.$<HTMLTextAreaElement>('textarea')!;
    expect(t.getAttribute('maxlength')).toBe('200');
    expect(t.readOnly).toBe(true);
  });

  describe('contador de caracteres', () => {
    it('con maxLength pinta "N/máx" bajo la caja y lo actualiza al escribir', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 10 } }]);
      const contador = f.$('.df-counter')!;
      expect(contador.textContent?.trim()).toBe('0/10');
      expect(f.$('textarea')!.getAttribute('aria-describedby')).toBe(contador.id);
      expect(f.$('textarea')!.nextElementSibling).toBe(contador);
      await f.type('textarea', 'hola');
      expect(f.$('.df-counter')!.textContent?.trim()).toBe('4/10');
      expect(f.$('.df-counter--limit')).toBeNull();
    });

    it('al llegar al máximo se marca y lo anuncia a lectores de pantalla', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 5 } }]);
      await f.type('textarea', 'abcde');
      expect(f.$('.df-counter--limit')?.textContent?.trim()).toBe('5/5');
      expect(f.$('[role=status]')?.textContent?.trim()).toBe('Has llegado al máximo de 5 caracteres');
      expect(f.$('.df-error'), 'en el límite todavía es válido').toBeNull();
    });

    it('el maxlength nativo es el que bloquea la escritura en el límite', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 5 } }]);
      expect(f.$('textarea')!.getAttribute('maxlength')).toBe('5');
    });

    it('si el modelo ya trae más texto del permitido, lo marca y salta la validación', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 5 } }], { model: { obs: 'demasiado' } });
      await f.submit();
      expect(f.$('.df-counter--limit')?.textContent?.trim()).toBe('9/5');
      expect(f.$('.df-error')?.textContent?.trim()).toBe('Máximo 5 caracteres');
    });

    it('sin maxLength no hay contador', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea' }]);
      expect(f.$('.df-counter')).toBeNull();
      expect(f.$('textarea')!.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('la ñ y los acentos cuentan 2 (modo por defecto)', () => {
    it('el contador suma 2 por cada carácter no ASCII', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 10 } }]);
      await f.type('textarea', 'año');
      expect(f.$('.df-counter')!.textContent?.trim()).toBe('4/10');
    });

    it('al escribir de más se recorta sin partir caracteres', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 5 } }]);
      await f.type('textarea', 'ñññ');
      expect(f.host.model['obs']).toBe('ññ');
      expect(f.$('.df-counter')!.textContent?.trim()).toBe('4/5');
      await f.type('textarea', 'abcdñ');
      expect(f.host.model['obs'], 'la ñ (2) ya no cabe entera después de 4').toBe('abcd');
      await f.type('textarea', 'abcñz');
      expect(f.host.model['obs'], 'abc + ñ = 5 caben; sobra la z').toBe('abcñ');
      await f.type('textarea', 'abcñ');
      expect(f.$('.df-counter--limit')?.textContent?.trim()).toBe('5/5');
    });

    it('un texto que solo se pasa contando la ñ doble salta la validación', async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 3 } }], { model: { obs: 'ññ' } });
      await f.submit();
      expect(f.$('.df-counter--limit')?.textContent?.trim()).toBe('4/3');
      expect(f.$('.df-error')?.textContent?.trim()).toBe('Máximo 3 caracteres');
    });

    it("con provideDynamicForms({ maxLengthMode: 'chars' }) cuenta normal", async () => {
      const f = await renderForm([{ key: 'obs', type: 'textarea', validation: { maxLength: 3 } }], { config: { maxLengthMode: 'chars' } });
      await f.type('textarea', 'ñññ');
      expect(f.host.model['obs']).toBe('ñññ');
      expect(f.$('.df-counter')!.textContent?.trim()).toBe('3/3');
      expect(f.$('.df-error')).toBeNull();
    });

    it('props.maxLengthMode del campo manda sobre la config', async () => {
      const f = await renderForm(
        [{ key: 'obs', type: 'textarea', validation: { maxLength: 4 }, props: { maxLengthMode: 'chars' } }],
      );
      await f.type('textarea', 'ññññ');
      expect(f.$('.df-counter')!.textContent?.trim()).toBe('4/4');
    });
  });
});
