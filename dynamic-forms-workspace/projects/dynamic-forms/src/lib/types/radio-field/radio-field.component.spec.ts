import { DfOption } from '../../models/schema.model';
import { renderForm } from '../../testing/render-form';

const OPTS: DfOption[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'nsnc', label: 'NS/NC', disabled: true },
];

describe('RadioFieldComponent (df-radio)', () => {
  it('pinta un radio por opción dentro de un radiogroup', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', label: 'Acepta', options: OPTS }]);
    expect(f.$('[role=radiogroup]')).not.toBeNull();
    expect(f.$$('.df-radio__label').map((l) => l.textContent?.trim())).toEqual(['Sí', 'No', 'NS/NC']);
  });

  it('comparten name y cada radio tiene un id único', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS }]);
    const radios = f.$$<HTMLInputElement>('input[type=radio]');
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(new Set(radios.map((r) => r.id)).size).toBe(3);
  });

  it('al hacer click guarda el valor en el modelo', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS }]);
    await f.click('.df-radio:nth-child(2) input');
    expect(f.host.model['r']).toBe('no');
  });

  it('marca el radio del modelo inicial', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS }], { model: { r: 'si' } });
    expect(f.$<HTMLInputElement>('.df-radio:nth-child(1) input')!.checked).toBe(true);
  });

  it('deshabilita las opciones con disabled', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS }]);
    expect(f.$<HTMLInputElement>('.df-radio:nth-child(3) input')!.disabled).toBe(true);
    expect(f.$('.df-radio--disabled .df-radio__label')?.textContent?.trim()).toBe('NS/NC');
  });

  it('props.inline los pone en línea', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS, props: { inline: true } }]);
    expect(f.$('.df-radio-group--inline')).not.toBeNull();
  });

  it('pulsar una opción deshabilitada no cambia el modelo', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS }], { model: { r: 'si' } });
    await f.click('.df-radio:nth-child(3) input');
    expect(f.host.model['r']).toBe('si');
  });

  it('conserva el tipo de los valores no string', async () => {
    const f = await renderForm([{ key: 'n', type: 'radio', options: [{ value: 1, label: 'Uno' }, { value: true, label: 'Verdad' }] }]);
    await f.click('.df-radio:nth-child(1) input');
    expect(f.host.model['n']).toBe(1);
    await f.click('.df-radio:nth-child(2) input');
    expect(f.host.model['n']).toBe(true);
  });

  it('actualiza el radio marcado cuando el modelo cambia desde fuera', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS }], { model: { r: 'si' } });
    f.host.dynamicForm.reset({ r: 'no' });
    await f.stable();
    expect(f.$$<HTMLInputElement>('input[type=radio]').map((r) => r.checked)).toEqual([false, true, false]);
  });

  it('disabled en el campo deshabilita todas las opciones', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS, disabled: true }]);
    expect(f.$$<HTMLInputElement>('input[type=radio]').every((r) => r.disabled)).toBe(true);
  });

  it('disabledWhen habilita y deshabilita respetando las opciones deshabilitadas', async () => {
    const f = await renderForm([
      { key: 'bloquear', type: 'checkbox' },
      { key: 'r', type: 'radio', options: OPTS, logic: { disabledWhen: { field: 'bloquear', operator: 'truthy' } } },
    ]);
    const estado = () => f.$$<HTMLInputElement>('input[type=radio]').map((r) => r.disabled);
    expect(estado()).toEqual([false, false, true]);
    await f.click('input[type=checkbox]');
    expect(estado()).toEqual([true, true, true]);
    await f.click('input[type=checkbox]');
    expect(estado()).toEqual([false, false, true]);
  });

  it('muestra el error de obligatorio al salir del campo', async () => {
    const f = await renderForm([{ key: 'r', type: 'radio', options: OPTS, validation: { required: true } }]);
    f.$('.df-radio:nth-child(1) input')!.dispatchEvent(new Event('blur'));
    await f.stable();
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Este campo es obligatorio');
    expect(f.$('[role=radiogroup]')!.getAttribute('aria-invalid')).toBe('true');
  });
});
