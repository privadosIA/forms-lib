import { renderForm } from '../../testing/render-form';

describe('FieldWrapperComponent (df-field)', () => {
  it('pinta la label asociada al control', async () => {
    const f = await renderForm([{ key: 'nombre', type: 'text', label: 'Nombre' }]);
    const label = f.$<HTMLLabelElement>('.df-label')!;
    expect(label.textContent?.trim()).toBe('Nombre');
    expect(label.htmlFor).toBe(f.$('input')!.id);
    expect(label.htmlFor).toBeTruthy();
  });

  it('sin label no pinta <label>', async () => {
    const f = await renderForm([{ key: 'nombre', type: 'text' }]);
    expect(f.$('.df-label')).toBeNull();
  });

  it('marca obligatorio con asterisco y clase', async () => {
    const f = await renderForm([{ key: 'nombre', type: 'text', label: 'Nombre', validation: { required: true } }]);
    expect(f.$('.df-field--required')).not.toBeNull();
    expect(f.$('.df-label .df-required')?.textContent).toBe('*');
  });

  it('pinta la descripción', async () => {
    const f = await renderForm([{ key: 'nombre', type: 'text', description: 'Tal como figura en el DNI' }]);
    expect(f.$('.df-description')?.textContent?.trim()).toBe('Tal como figura en el DNI');
  });

  it('añade la clase de deshabilitado', async () => {
    const f = await renderForm([{ key: 'nombre', type: 'text', disabled: true }]);
    expect(f.$('.df-field--disabled')).not.toBeNull();
  });

  it('muestra el error en un role=alert solo tras tocar el campo', async () => {
    const f = await renderForm([{ key: 'nombre', type: 'text', validation: { required: true } }]);
    expect(f.$('.df-error')).toBeNull();
    expect(f.$('.df-field--invalid')).toBeNull();
    await f.type('input', '');
    expect(f.$('.df-field--invalid')).not.toBeNull();
    expect(f.$('.df-error[role=alert]')?.textContent?.trim()).toBe('Este campo es obligatorio');
  });

  it('usa el mensaje propio del campo antes que el global', async () => {
    const f = await renderForm([{ key: 'nombre', type: 'text', validation: { required: true, messages: { required: 'Dinos tu nombre' } } }]);
    await f.submit();
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Dinos tu nombre');
  });

  it('usa los mensajes globales de la config', async () => {
    const f = await renderForm(
      [{ key: 'nombre', type: 'text', validation: { required: true } }],
      { config: { messages: { required: 'Obligatorio' } } },
    );
    await f.submit();
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Obligatorio');
  });

  it('resuelve los placeholders {{x}} de los mensajes del campo', async () => {
    const f = await renderForm([{
      key: 'nombre', type: 'text', label: 'Nombre',
      validation: { minLength: 3, messages: { minLength: '{{label}}: mínimo {{minLength}} caracteres' } },
    }]);
    await f.type('input', 'a');
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Nombre: mínimo 3 caracteres');
  });
});
