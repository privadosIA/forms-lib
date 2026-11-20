import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DfOptionsProvider } from '../../models/config.model';
import { DfOption } from '../../models/schema.model';
import { renderForm } from '../../testing/render-form';

const OPTS: DfOption[] = [
  { value: 1, label: 'Uno' },
  { value: 2, label: 'Dos' },
  { value: 3, label: 'Tres', disabled: true },
];
const labels = (options: HTMLOptionElement[]) => options.map((o) => o.textContent?.trim());

describe('SelectFieldComponent (df-select)', () => {
  it('pinta un placeholder por defecto y las opciones', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', options: OPTS }]);
    expect(labels(f.$$('option'))).toEqual(['— Selecciona —', 'Uno', 'Dos', 'Tres']);
  });

  it('sin valor en el modelo muestra seleccionado el placeholder', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', options: OPTS }]);
    const select = f.$<HTMLSelectElement>('select')!;
    expect(select.selectedIndex).toBe(0);
    expect(select.options[0].textContent?.trim()).toBe('— Selecciona —');
  });

  it('elegir el placeholder deja el campo vacío y sigue seleccionado', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', options: OPTS, validation: { required: true } }]);
    await f.choose('select', 'Dos');
    await f.choose('select', '— Selecciona —');
    expect(f.host.model['n']).toBeNull();
    expect(f.$<HTMLSelectElement>('select')!.selectedIndex).toBe(0);
    await f.submit();
    expect(f.$('.df-error')?.textContent?.trim()).toBe('Este campo es obligatorio');
  });

  it('usa props.placeholder como primera opción', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', placeholder: 'Elige un número', options: OPTS }]);
    expect(f.$('option')?.textContent?.trim()).toBe('Elige un número');
  });

  it('conserva el tipo del value en el modelo', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', options: OPTS }]);
    await f.choose('select', 'Dos');
    expect(f.host.model['n']).toBe(2);
  });

  it('refleja el modelo inicial en la selección', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', options: OPTS }], { model: { n: 2 } });
    const select = f.$<HTMLSelectElement>('select')!;
    expect(select.options[select.selectedIndex].textContent?.trim()).toBe('Dos');
  });

  it('deshabilita las opciones con disabled', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', options: OPTS }]);
    expect(f.$$<HTMLOptionElement>('option').map((o) => o.disabled)).toEqual([false, false, false, true]);
  });

  it('acepta opciones static', async () => {
    const f = await renderForm([{ key: 'n', type: 'select', options: { source: 'static', items: OPTS.slice(0, 1) } }]);
    expect(labels(f.$$('option'))).toEqual(['— Selecciona —', 'Uno']);
  });

  it('acepta opciones como Observable (remote)', async () => {
    @Injectable()
    class Provider implements DfOptionsProvider {
      load(): Observable<DfOption[]> {
        return of(OPTS.slice(0, 2));
      }
    }
    const f = await renderForm(
      [{ key: 'n', type: 'select', options: { source: 'remote', endpoint: '/numeros' } }],
      { config: { optionsProvider: Provider } },
    );
    expect(labels(f.$$('option'))).toEqual(['— Selecciona —', 'Uno', 'Dos']);
  });

  describe('multiselect', () => {
    it('pinta un select múltiple sin placeholder', async () => {
      const f = await renderForm([{ key: 'm', type: 'multiselect', options: OPTS }]);
      const select = f.$<HTMLSelectElement>('select')!;
      expect(select.multiple).toBe(true);
      expect(select.classList).toContain('df-select--multiple');
      expect(labels(f.$$('option'))).toEqual(['Uno', 'Dos', 'Tres']);
    });

    it('guarda un array con los valores elegidos', async () => {
      const f = await renderForm([{ key: 'm', type: 'multiselect', options: OPTS }]);
      const select = f.$<HTMLSelectElement>('select')!;
      select.options[0].selected = true;
      select.options[1].selected = true;
      select.dispatchEvent(new Event('change'));
      await f.stable();
      expect(f.host.model['m']).toEqual([1, 2]);
    });
  });
});
