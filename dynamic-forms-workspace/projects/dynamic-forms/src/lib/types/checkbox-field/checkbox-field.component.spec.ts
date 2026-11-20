import { renderForm } from '../../testing/render-form';

describe('CheckboxFieldComponent (df-checkbox)', () => {
  it('pinta la label junto al checkbox y el wrapper no la duplica', async () => {
    const f = await renderForm([{ key: 'acepto', type: 'checkbox', label: 'Acepto las condiciones' }]);
    expect(f.$('.df-checkbox__label')?.textContent?.trim()).toBe('Acepto las condiciones');
    expect(f.$('.df-label')).toBeNull();
  });

  it('marca el obligatorio con asterisco', async () => {
    const f = await renderForm([{ key: 'acepto', type: 'checkbox', label: 'Acepto', validation: { required: true } }]);
    expect(f.$('.df-checkbox__label .df-required')).not.toBeNull();
  });

  it('alterna el valor booleano en el modelo', async () => {
    const f = await renderForm([{ key: 'acepto', type: 'checkbox', label: 'Acepto' }]);
    await f.click('input[type=checkbox]');
    expect(f.host.model['acepto']).toBe(true);
    await f.click('input[type=checkbox]');
    expect(f.host.model['acepto']).toBe(false);
  });

  it('refleja el modelo inicial', async () => {
    const f = await renderForm([{ key: 'acepto', type: 'checkbox' }], { model: { acepto: true } });
    expect(f.$<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
  });
});
