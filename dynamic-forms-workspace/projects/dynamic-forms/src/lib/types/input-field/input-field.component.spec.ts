import { renderForm } from '../../testing/render-form';

describe('InputFieldComponent (df-input)', () => {
  it('usa type="text" por defecto', async () => {
    const f = await renderForm([{ key: 'a', type: 'text' }]);
    expect(f.$<HTMLInputElement>('input.df-control')!.type).toBe('text');
  });

  it('traduce email, password y date al type nativo', async () => {
    const f = await renderForm([
      { key: 'email', type: 'email' }, { key: 'clave', type: 'password' }, { key: 'fecha', type: 'date' },
    ]);
    expect(f.$$<HTMLInputElement>('input').map((i) => i.type)).toEqual(['email', 'password', 'date']);
  });

  it('number pinta min, max y step y guarda un número en el modelo', async () => {
    const f = await renderForm([{ key: 'edad', type: 'number', validation: { min: 18, max: 99 }, props: { step: 1 } }]);
    const input = f.$<HTMLInputElement>('input')!;
    expect(input.type).toBe('number');
    expect(input.getAttribute('min')).toBe('18');
    expect(input.getAttribute('max')).toBe('99');
    expect(input.getAttribute('step')).toBe('1');
    await f.type('input', '42');
    expect(f.host.model['edad']).toBe(42);
  });

  it('pinta minlength, maxlength y autocomplete en los de texto', async () => {
    const f = await renderForm([{ key: 'a', type: 'text', validation: { minLength: 2, maxLength: 9 }, props: { autocomplete: 'off' } }]);
    const input = f.$<HTMLInputElement>('input')!;
    expect(input.getAttribute('minlength')).toBe('2');
    expect(input.getAttribute('maxlength')).toBe('9');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('respeta readonly', async () => {
    const f = await renderForm([{ key: 'a', type: 'text', readonly: true }]);
    expect(f.$<HTMLInputElement>('input')!.readOnly).toBe(true);
  });

  it('deshabilita el control con disabled', async () => {
    const f = await renderForm([{ key: 'a', type: 'text', disabled: true }]);
    expect(f.$<HTMLInputElement>('input')!.disabled).toBe(true);
  });

  it('marca aria-invalid solo cuando se muestra el error', async () => {
    const f = await renderForm([{ key: 'a', type: 'text', validation: { required: true } }]);
    expect(f.$('input')!.getAttribute('aria-invalid')).toBe('false');
    await f.submit();
    expect(f.$('input')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('muestra los mensajes built-in de minlength y pattern', async () => {
    const f = await renderForm([{ key: 'a', type: 'text', validation: { minLength: 3, pattern: '^[a-z]+$' } }]);
    await f.type('input', 'ab');
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Mínimo 3 caracteres');
    await f.type('input', 'ABC');
    expect(f.$('.df-error')?.textContent?.trim()).toBe('El formato no es válido');
  });

  it('muestra el mensaje built-in de maxLength con la clave de error de Formly v6', async () => {
    // Al escribir no se puede pasar del máximo; el error aparece si el modelo ya trae texto de más.
    const f = await renderForm([{ key: 'a', type: 'text', validation: { maxLength: 2 } }], { model: { a: 'abc' } });
    await f.submit();
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Máximo 2 caracteres');
    expect(f.host.dynamicForm.form.get('a')!.errors).toEqual({ maxLength: expect.objectContaining({ requiredLength: 2 }) });
  });

  it('sigue aceptando la clave antigua minlength en los mensajes del campo', async () => {
    const f = await renderForm([{ key: 'a', type: 'text', validation: { minLength: 3, messages: { minlength: 'Muy corto' } } }]);
    await f.type('input', 'ab');
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Muy corto');
  });

  it('los campos email validan el formato con el mensaje built-in', async () => {
    const f = await renderForm([{ key: 'correo', type: 'email' }]);
    await f.type('input', 'no-es-email');
    expect(f.host.dynamicForm.valid).toBe(false);
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Debe ser un email válido');
    await f.type('input', 'ana@ejemplo.es');
    expect(f.host.dynamicForm.valid).toBe(true);
    await f.type('input', '');
    expect(f.host.dynamicForm.valid, 'vacío es válido: de eso se encarga required').toBe(true);
  });

  it('los campos text no validan formato de email', async () => {
    const f = await renderForm([{ key: 'a', type: 'text' }]);
    await f.type('input', 'no-es-email');
    expect(f.host.dynamicForm.valid).toBe(true);
  });

  it('los inputs de texto también recortan contando la ñ y los acentos como 2', async () => {
    const f = await renderForm([{ key: 'a', type: 'text', validation: { maxLength: 5 } }]);
    await f.type('input', 'Peñón');
    expect(f.host.model['a']).toBe('Peñ');
  });
});
