import { renderForm } from '../../testing/render-form';

describe('HiddenFieldComponent (df-hidden)', () => {
  it('pinta un input hidden sin wrapper ni label', async () => {
    const f = await renderForm([{ key: 'token', type: 'hidden', label: 'No debería verse' }]);
    expect(f.$('input[type=hidden]')).not.toBeNull();
    expect(f.$('.df-field')).toBeNull();
    expect(f.$('.df-label')).toBeNull();
    expect(f.$('.df-hidden-slot')).not.toBeNull();
  });

  it('mantiene su valor en el modelo y lo envía', async () => {
    const f = await renderForm(
      [{ key: 'proceso', type: 'hidden', defaultValue: 'P-1' }, { key: 'nombre', type: 'text' }],
      { model: { token: 'abc' } },
    );
    await f.type('input[type=text]', 'Ana');
    await f.submit();
    expect(f.host.submitted[0].model).toEqual(expect.objectContaining({ proceso: 'P-1', nombre: 'Ana' }));
  });
});
