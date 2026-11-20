import { Component, Injectable } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { DfOptionsProvider, DfValidatorDefinition } from '../models/config.model';
import { DfField, DfOption } from '../models/schema.model';
import { formSchema, renderForm } from '../testing/render-form';

describe('DynamicFormComponent', () => {
  const nombre = { key: 'nombre', type: 'text', label: 'Nombre', validation: { required: true } } as const;

  describe('render', () => {
    it('pinta título, descripción, id del form y clases del tema', async () => {
      const f = await renderForm([nombre], { title: 'Alta', description: 'Datos del cliente' });
      expect(f.$('.df-form__title')?.textContent?.trim()).toBe('Alta');
      expect(f.$('.df-form__description')?.textContent?.trim()).toBe('Datos del cliente');
      expect(f.$('form')?.id).toBe('df-prueba');
      expect(f.$('dynamic-form')?.className).toBe('df-form df-theme-plain');
    });

    it('omite la cabecera si el esquema no tiene título', async () => {
      const f = await renderForm([nombre]);
      expect(f.$('.df-form__header')).toBeNull();
    });

    it('proyecta los slots dfHeader y dfActions', async () => {
      const f = await renderForm([nombre]);
      expect(f.$('form > .test-header')).not.toBeNull();
      expect(f.$('.df-form__actions .test-action')).not.toBeNull();
    });

    it('pinta el botón de envío por defecto con submitLabel', async () => {
      const f = await renderForm([nombre], { host: { submitLabel: 'Guardar' } });
      expect(f.$('button[type=submit]')?.textContent?.trim()).toBe('Guardar');
    });

    it('showDefaultActions=false quita el botón por defecto pero mantiene dfActions', async () => {
      const f = await renderForm([nombre], { host: { showDefaultActions: false } });
      expect(f.$('button[type=submit]')).toBeNull();
      expect(f.$('.test-action')).not.toBeNull();
    });

    it('pinta el grid y un control por campo', async () => {
      const f = await renderForm(formSchema([nombre, { key: 'email', type: 'email' }], { layout: { columns: 2 } }));
      expect(f.$('.df-grid.df-grid--2')).not.toBeNull();
      expect(f.$$('.df-col-6 input').length).toBe(2);
    });

    it('aplica layout.gap como --df-grid-gap en el host', async () => {
      const f = await renderForm(formSchema([nombre], { layout: { gap: '2rem' } }));
      expect(f.$('dynamic-form')!.style.getPropertyValue('--df-grid-gap')).toBe('2rem');
    });

    it('ignora un layout.gap que no es una longitud CSS (modo no estricto)', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const f = await renderForm(formSchema([nombre], { layout: { gap: 'url(x)' } }), { config: { strictSchema: false } });
      expect(f.$('dynamic-form')!.style.getPropertyValue('--df-grid-gap')).toBe('');
      vi.restoreAllMocks();
    });

    it('rellena los controles con el modelo inicial', async () => {
      const f = await renderForm([nombre], { model: { nombre: 'Ana' } });
      expect(f.$<HTMLInputElement>('input')!.value).toBe('Ana');
    });
  });

  describe('modelo y eventos', () => {
    it('[(model)] y valueChange reflejan lo que escribe el usuario', async () => {
      const f = await renderForm([nombre]);
      await f.type('input', 'Luis');
      expect(f.host.model).toEqual({ nombre: 'Luis' });
      expect(f.host.changes.at(-1)).toEqual({ nombre: 'Luis' });
    });

    it('statusChange emite el estado inicial al montar (Formly ≥ 10)', async () => {
      const valido = await renderForm([{ key: 'x', type: 'text' }]);
      expect(valido.host.statuses).toEqual(['VALID']);
      TestBed.resetTestingModule();
      const invalido = await renderForm([nombre]);
      expect(invalido.host.statuses).toEqual(['INVALID']);
    });

    it('statusChange emite al cambiar la validez', async () => {
      const f = await renderForm([nombre]);
      await f.type('input', 'Luis');
      expect(f.host.statuses).toContain('VALID');
      await f.type('input', '');
      expect(f.host.statuses.at(-1)).toBe('INVALID');
    });

    it('incluye defaultValue en el modelo', async () => {
      const f = await renderForm([{ key: 'pais', type: 'text', defaultValue: 'ES' }]);
      expect(f.host.model).toEqual({ pais: 'ES' });
    });
  });

  describe('submit', () => {
    it('con el formulario inválido emite formInvalidSubmit y muestra los errores', async () => {
      const f = await renderForm([nombre]);
      expect(f.$('.df-error')).toBeNull();
      await f.submit();
      expect(f.host.submitted).toEqual([]);
      expect(f.host.invalidSubmitted.length).toBe(1);
      expect(f.$('.df-error')?.textContent?.trim()).toBe('Este campo es obligatorio');
    });

    it('con el formulario válido emite formSubmit con modelo, form y esquema', async () => {
      const f = await renderForm([nombre]);
      await f.type('input', 'Luis');
      await f.submit();
      expect(f.host.invalidSubmitted).toEqual([]);
      const [event] = f.host.submitted;
      expect(event.model).toEqual({ nombre: 'Luis' });
      expect(event.form).toBe(f.host.dynamicForm.form);
      expect(event.schema).toBe(f.host.schema);
    });

    it('validateOnInit muestra los errores sin esperar al envío', async () => {
      const f = await renderForm([nombre], { host: { validateOnInit: true } });
      await f.stable();
      expect(f.$('.df-error')).not.toBeNull();
    });
  });

  describe('showErrors y revalidate', () => {
    it("showErrors='always' muestra los errores de los campos que aparecen después", async () => {
      const f = await renderForm([
        { key: 'tipo', type: 'select', label: 'Tipo', options: [{ value: 'empresa', label: 'Empresa' }] },
        {
          key: 'cif', type: 'text', label: 'CIF', validation: { required: true },
          logic: { showWhen: { field: 'tipo', operator: 'eq', value: 'empresa' } },
        },
      ], { host: { showErrors: 'always' } });
      await f.stable();
      expect(f.$('.df-error')).toBeNull();
      await f.choose('select', 'Empresa');
      await f.stable();
      expect(f.$('.df-error')?.textContent?.trim()).toBe('Este campo es obligatorio');
    });

    it('sin showErrors el campo recién aparecido no muestra error hasta tocarlo', async () => {
      const f = await renderForm([
        { key: 'tipo', type: 'select', label: 'Tipo', options: [{ value: 'empresa', label: 'Empresa' }] },
        {
          key: 'cif', type: 'text', label: 'CIF', validation: { required: true },
          logic: { showWhen: { field: 'tipo', operator: 'eq', value: 'empresa' } },
        },
      ]);
      await f.choose('select', 'Empresa');
      await f.stable();
      expect(f.$('.df-error')).toBeNull();
    });

    it('revalidate() vuelve a ejecutar los validadores que leen estado externo', async () => {
      let ok = false;
      const externo: DfValidatorDefinition = { name: 'externo', message: 'no permitido', validate: () => ok };
      const f = await renderForm(
        [{ key: 'a', type: 'text', validation: { validators: [{ name: 'externo' }] } }],
        { config: { validators: [externo] }, model: { a: 'x' } },
      );
      const form = f.host.dynamicForm;
      expect(form.valid).toBe(false);
      ok = true;
      form.markAllAsTouched();
      expect(form.valid).toBe(false);
      form.revalidate();
      expect(form.valid).toBe(true);
    });
  });

  describe('context y rutas ctx.', () => {
    const ver = { field: 'ctx.modo', operator: 'eq', value: 'edicion' } as const;

    it('una condición con ctx.nombre lee del contexto y se reevalúa al cambiarlo', async () => {
      const f = await renderForm(
        [{ key: 'obs', type: 'text', label: 'Observaciones', logic: { showWhen: ver } }],
        { host: { context: { modo: 'lectura' } } },
      );
      expect(f.$$('input')).toHaveLength(0);
      f.host.context = { modo: 'edicion' };
      f.fixture.changeDetectorRef.markForCheck();
      await f.stable();
      expect(f.$$('input')).toHaveLength(1);
      f.host.context = { modo: 'lectura' };
      f.fixture.changeDetectorRef.markForCheck();
      await f.stable();
      expect(f.$$('input')).toHaveLength(0);
    });

    it('cambiar el esquema y el contexto a la vez no falla (Formly aún no ha construido la raíz nueva)', async () => {
      const f = await renderForm(
        [{ key: 'obs', type: 'text', label: 'Observaciones', logic: { showWhen: ver } }],
        { host: { context: { modo: 'lectura' } } },
      );
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      f.host.schema = formSchema([{ key: 'otra', type: 'text', label: 'Otra', logic: { showWhen: ver } }]);
      f.host.context = { modo: 'edicion' };
      f.fixture.changeDetectorRef.markForCheck();
      await f.stable();
      expect(errors).not.toHaveBeenCalled();
      expect(f.$$('input')).toHaveLength(1);
    });

    it('requiredWhen y disabledWhen también leen del contexto, y se combinan con campos del modelo', async () => {
      const f = await renderForm(
        [
          { key: 'a', type: 'text', label: 'A' },
          { key: 'b', type: 'text', label: 'B', logic: { disabledWhen: { all: [{ field: 'ctx.bloqueado', operator: 'truthy' }, { field: 'a', operator: 'notEmpty' }] } } },
        ],
        { host: { context: { bloqueado: true } } },
      );
      const b = () => f.$$<HTMLInputElement>('input')[1];
      expect(b().disabled).toBe(false);
      await f.type('input', 'x');
      expect(b().disabled).toBe(true);
    });

    it('una acción de fila lee del contexto', async () => {
      const f = await renderForm(
        [{
          type: 'table', id: 't', columns: [{ key: 'n', label: 'N' }], rows: [{ n: 1 }],
          actions: [{ name: 'borrar', label: 'Borrar', showWhen: { field: 'ctx.admin', operator: 'truthy' } }],
        }],
        { host: { context: { admin: false } } },
      );
      expect(f.$$('.df-table__action')).toHaveLength(0);
      f.host.context = { admin: true };
      f.fixture.changeDetectorRef.markForCheck();
      await f.stable();
      expect(f.$$('.df-table__action')).toHaveLength(1);
    });
  });

  describe('API pública', () => {
    it('valid refleja el estado del FormGroup', async () => {
      const f = await renderForm([nombre]);
      expect(f.host.dynamicForm.valid).toBe(false);
      await f.type('input', 'Luis');
      expect(f.host.dynamicForm.valid).toBe(true);
    });

    it('reset() vuelve al modelo inicial', async () => {
      const f = await renderForm([nombre], { model: { nombre: 'Ana' } });
      await f.type('input', 'Luis');
      f.host.dynamicForm.reset();
      await f.stable();
      expect(f.host.model).toEqual({ nombre: 'Ana' });
      expect(f.$<HTMLInputElement>('input')!.value).toBe('Ana');
    });

    it('reset(model) carga otro modelo', async () => {
      const f = await renderForm([nombre]);
      f.host.dynamicForm.reset({ nombre: 'Eva' });
      await f.stable();
      expect(f.host.model).toEqual({ nombre: 'Eva' });
      expect(f.$<HTMLInputElement>('input')!.value).toBe('Eva');
    });

    it('cambiar de esquema vuelve a pintar el formulario', async () => {
      const f = await renderForm([nombre]);
      await f.setSchema(formSchema([{ key: 'otro', type: 'textarea' }], { id: 'otro' }));
      expect(f.$('form')?.id).toBe('df-otro');
      expect(f.$('textarea')).not.toBeNull();
    });
  });

  describe('integración', () => {
    const tipo: DfField = {
      key: 'tipo', type: 'select', label: 'Tipo',
      options: [{ value: 'particular', label: 'Particular' }, { value: 'empresa', label: 'Empresa' }],
    };

    it('showWhen muestra y oculta campos, y resetOnHide limpia su valor', async () => {
      const f = await renderForm([
        tipo,
        { key: 'cif', type: 'text', label: 'CIF', logic: { showWhen: { field: 'tipo', operator: 'eq', value: 'empresa' } } },
      ]);
      expect(f.$$('input').length).toBe(0);

      await f.choose('select', 'Empresa');
      expect(f.$$('input').length).toBe(1);
      await f.type('input', 'B12345674');
      expect(f.host.model['cif']).toBe('B12345674');

      await f.choose('select', 'Particular');
      expect(f.$$('input').length).toBe(0);
      expect(f.host.model['cif']).toBeUndefined();
    });

    it('requiredWhen activa el obligatorio según el modelo', async () => {
      const f = await renderForm([
        tipo,
        { key: 'razon', type: 'text', label: 'Razón social', logic: { requiredWhen: { field: 'tipo', operator: 'eq', value: 'empresa' } } },
      ]);
      expect(f.host.dynamicForm.valid).toBe(true);
      await f.choose('select', 'Empresa');
      expect(f.host.dynamicForm.valid).toBe(false);
      expect(f.$('.df-field--required .df-required')).not.toBeNull();
    });

    it('los validadores de negocio muestran su mensaje', async () => {
      const f = await renderForm([{ key: 'dni', type: 'text', label: 'DNI', validation: { validators: [{ name: 'dni' }] } }]);
      await f.type('input', '12345678A');
      expect(f.$('.df-error')?.textContent?.trim()).toBe('El DNI no es válido');
      await f.type('input', '12345678Z');
      expect(f.$('.df-error')).toBeNull();
    });

    it('opciones dependientes: el hijo se rellena y se vacía al cambiar el padre', async () => {
      const f = await renderForm([
        { key: 'provincia', type: 'select', options: [{ value: '28', label: 'Madrid' }, { value: '08', label: 'Barcelona' }] },
        {
          key: 'municipio', type: 'select',
          options: {
            source: 'dependent', dependsOn: 'provincia',
            map: { '28': [{ value: 'alcala', label: 'Alcalá' }], '08': [{ value: 'sabadell', label: 'Sabadell' }] },
          },
        },
      ]);
      const provincia = 'select[id*="_provincia_"]';
      const municipio = 'select[id*="_municipio_"]';
      await f.choose(provincia, 'Madrid');
      expect(f.$$<HTMLOptionElement>(`${municipio} option`).map((o) => o.textContent?.trim())).toEqual(['— Selecciona —', 'Alcalá']);

      await f.choose(municipio, 'Alcalá');
      expect(f.host.model['municipio']).toBe('alcala');

      await f.choose(provincia, 'Barcelona');
      expect(f.host.model['municipio']).toBeNull();
      expect(f.$$<HTMLOptionElement>(`${municipio} option`).map((o) => o.textContent?.trim())).toEqual(['— Selecciona —', 'Sabadell']);
    });

    it('opciones remotas a través del optionsProvider configurado', async () => {
      @Injectable()
      class CallesProvider implements DfOptionsProvider {
        load(endpoint: string, params: Record<string, unknown>): Observable<DfOption[]> {
          return of([{ value: `${endpoint}-${String(params['cp'])}`, label: `Calle de ${String(params['cp'])}` }]);
        }
      }
      const f = await renderForm(
        [
          { key: 'cp', type: 'text' },
          { key: 'calle', type: 'select', options: { source: 'remote', endpoint: '/calles', dependsOn: ['cp'] } },
        ],
        { config: { optionsProvider: CallesProvider } },
      );
      expect(f.$$('select option').length).toBe(1);
      await f.type('input', '28001');
      await f.choose('select', 'Calle de 28001');
      expect(f.host.model['calle']).toBe('/calles-28001');
    });

    it('renderiza tipos propios registrados con provideDynamicForms({ types }) en modo estricto', async () => {
      @Component({
        standalone: true,
        imports: [ReactiveFormsModule, FormlyModule],
        template: `<input class="firma" [formControl]="formControl" [formlyAttributes]="field" />`,
      })
      class FirmaFieldComponent extends FieldType<FieldTypeConfig> {}

      const f = await renderForm(
        [{ key: 'firma', type: 'firma', label: 'Firma' }],
        { config: { types: [{ name: 'firma', component: FirmaFieldComponent }] } },
      );
      expect(f.$('.df-label')?.textContent?.trim()).toBe('Firma');
      await f.type('input.firma', 'A. Pérez');
      expect(f.host.model).toEqual({ firma: 'A. Pérez' });
    });

    it('mientras un validador async está pendiente el botón se deshabilita, y se rehabilita al resolver', async () => {
      const pendiente = new Subject<boolean>();
      const lento: DfValidatorDefinition = { name: 'lento', async: true, message: 'ocupado', validate: () => pendiente };
      const f = await renderForm(
        [{ key: 'usuario', type: 'text', validation: { asyncValidators: [{ name: 'lento' }] } }],
        { config: { validators: [lento] } },
      );
      const boton = () => f.$<HTMLButtonElement>('button[type=submit]')!;

      await f.type('input', 'ana');
      expect(f.host.dynamicForm.form.pending).toBe(true);
      expect(boton().disabled).toBe(true);

      pendiente.next(true);
      pendiente.complete();
      await f.stable();
      expect(f.host.dynamicForm.form.pending).toBe(false);
      expect(boton().disabled).toBe(false);
    });
  });
});
