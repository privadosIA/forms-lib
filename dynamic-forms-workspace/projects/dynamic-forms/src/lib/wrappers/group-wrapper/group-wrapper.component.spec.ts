import { renderForm } from '../../testing/render-form';

describe('GroupWrapperComponent (df-group)', () => {
  it('pinta un fieldset con legend, descripción e id del grupo', async () => {
    const f = await renderForm([{
      type: 'group', id: 'contacto', title: 'Contacto', description: 'Cómo te localizamos',
      fields: [{ key: 'email', type: 'email' }],
    }]);
    const fieldset = f.$('fieldset.df-group')!;
    expect(fieldset.getAttribute('data-group-id')).toBe('contacto');
    expect(f.$('legend')?.textContent?.trim()).toBe('Contacto');
    expect(f.$('.df-group__description')?.textContent?.trim()).toBe('Cómo te localizamos');
    expect(fieldset.querySelector('input[type=email]')).not.toBeNull();
  });

  it('la cssClass del grupo también llega al fieldset', async () => {
    const f = await renderForm([{ type: 'group', id: 'g', cssClass: 'sin-marco', fields: [{ key: 'a', type: 'text' }] }]);
    expect(f.$('fieldset.df-group')?.classList.contains('sin-marco')).toBe(true);
  });

  it('sin título ni descripción no pinta legend ni párrafo', async () => {
    const f = await renderForm([{ type: 'group', id: 'g', fields: [{ key: 'a', type: 'text' }] }]);
    expect(f.$('legend')).toBeNull();
    expect(f.$('.df-group__description')).toBeNull();
  });

  it('los campos del grupo escriben en el modelo raíz (el grupo no tiene key)', async () => {
    const f = await renderForm([{ type: 'group', id: 'g', fields: [{ key: 'a', type: 'text' }] }]);
    await f.type('input', 'x');
    expect(f.host.model).toEqual({ a: 'x' });
  });

  it('anida grupos', async () => {
    const f = await renderForm([{
      type: 'group', id: 'fuera', title: 'Fuera',
      fields: [{ type: 'group', id: 'dentro', title: 'Dentro', fields: [{ key: 'a', type: 'text' }] }],
    }]);
    expect(f.$('fieldset[data-group-id=fuera] fieldset[data-group-id=dentro] input')).not.toBeNull();
  });
});
