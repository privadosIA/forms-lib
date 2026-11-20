import { renderForm } from '../../testing/render-form';

describe('SlotFieldComponent (df-slot)', () => {
  const nombre = { key: 'nombre', type: 'text', label: 'Nombre' } as const;

  it('pinta la plantilla dfSlot entre los campos, en el sitio que ocupa en el esquema', async () => {
    const f = await renderForm([nombre, { type: 'slot', name: 'resumen' }, { key: 'otro', type: 'text', label: 'Otro' }]);
    const order = f.$$('input, .slot-resumen').map((e) => e.tagName);
    expect(order).toEqual(['INPUT', 'P', 'INPUT']);
    expect(f.$('.slot-resumen')?.getAttribute('data-name')).toBe('resumen');
  });

  it('la plantilla recibe el modelo y se actualiza cuando el usuario escribe', async () => {
    const f = await renderForm([nombre, { type: 'slot', name: 'resumen' }], { model: { nombre: 'Ana' } });
    expect(f.$('.slot-resumen')?.textContent).toBe('Hola Ana');
    await f.type('input', 'Luis');
    expect(f.$('.slot-resumen')?.textContent).toBe('Hola Luis');
  });

  it('no escribe nada en el modelo ni crea un control', async () => {
    const f = await renderForm([nombre, { type: 'slot', name: 'resumen' }], { model: { nombre: 'Ana' } });
    expect(Object.keys(f.host.dynamicForm.form.controls)).toEqual(['nombre']);
    expect(f.host.model).toEqual({ nombre: 'Ana' });
  });

  it('un slot sin plantilla con ese nombre no pinta nada (y no falla)', async () => {
    const f = await renderForm([nombre, { type: 'slot', name: 'noexiste' }]);
    expect(f.$('.slot-resumen')).toBeNull();
    expect(f.$$('input')).toHaveLength(1);
  });

  it('admite logic (showWhen) y puede ir dentro de un grupo', async () => {
    const f = await renderForm([
      { key: 'ver', type: 'checkbox', label: 'Ver' },
      { type: 'group', id: 'g', fields: [{ type: 'slot', name: 'resumen', logic: { showWhen: { field: 'ver', operator: 'truthy' } } }] },
    ]);
    expect(f.$('.slot-resumen')).toBeNull();
    f.$<HTMLInputElement>('input[type=checkbox]')!.click();
    await f.stable();
    expect(f.$('fieldset .slot-resumen')).not.toBeNull();
  });
});
