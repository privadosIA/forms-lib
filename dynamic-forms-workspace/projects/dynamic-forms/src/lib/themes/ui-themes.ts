import { EnvironmentProviders, Provider } from '@angular/core';
import { DfTheme } from '../models/config.model';
import { HiddenFieldComponent, RepeatFieldComponent, SlotFieldComponent, TableFieldComponent } from '../types';
import { FieldWrapperComponent, GroupWrapperComponent } from '../wrappers';

/**
 * Temas que delegan en los paquetes UI oficiales de Formly. La librería NO
 * depende de ellos: la app consumidora instala @ngx-formly/material (o
 * bootstrap) y pasa sus providers, p. ej.:
 *
 *   provideDynamicForms({
 *     theme: materialTheme([importProvidersFrom(FormlyMaterialModule, MatNativeDateModule)]),
 *   })
 *
 * `currency` se pinta con el input de texto del paquete UI: valida el formato (currencyFormat/currencyDecimals)
 * pero no formatea ni escribe el importe en letra, y el modelo guarda el texto. El campo completo solo
 * existe en PLAIN_THEME, porque el form-field de Material exige un MatFormFieldControl.
 * Las listas repetibles (`array`) y las tablas de datos (`table`) se pintan con `df-repeat` y `df-table`, los mismos componentes de la librería en todos los temas.
 */
const sharedConfig: DfTheme['formlyConfig'] = {
  types: [
    { name: 'df-hidden', component: HiddenFieldComponent },
    { name: 'df-repeat', component: RepeatFieldComponent },
    { name: 'df-table', component: TableFieldComponent },
    { name: 'df-slot', component: SlotFieldComponent },
  ],
  wrappers: [
    { name: 'df-group', component: GroupWrapperComponent },
    { name: 'df-field', component: FieldWrapperComponent },
  ],
};

export function materialTheme(providers: (Provider | EnvironmentProviders)[] = [], overrides: Partial<DfTheme> = {}): DfTheme {
  return {
    name: 'material',
    hostClass: 'df-theme-material',
    fieldWrappers: ['form-field'],
    groupWrapper: 'df-group',
    providers,
    formlyConfig: sharedConfig,
    typeMap: {
      text: 'input', email: 'input', password: 'input', number: 'input',
      date: 'datepicker', textarea: 'textarea', select: 'select', multiselect: 'select',
      radio: 'radio', checkbox: 'checkbox', hidden: 'df-hidden', currency: 'input',
    },
    // checkbox y radio no son un MatFormFieldControl: dentro de un mat-form-field salen en un recuadro. Van con el
    // wrapper de la librería (descripción y errores); el checkbox pinta su propia etiqueta.
    typeWrappers: { checkbox: ['df-field'], radio: ['df-field'] },
    typeProps: { multiselect: { multiple: true }, checkbox: { hideLabel: true } },
    ...overrides,
  };
}

export function bootstrapTheme(providers: (Provider | EnvironmentProviders)[] = [], overrides: Partial<DfTheme> = {}): DfTheme {
  return {
    name: 'bootstrap',
    hostClass: 'df-theme-bootstrap',
    fieldWrappers: ['form-field'],
    groupWrapper: 'df-group',
    providers,
    formlyConfig: sharedConfig,
    typeMap: {
      text: 'input', email: 'input', password: 'input', number: 'input',
      date: 'input', textarea: 'textarea', select: 'select', multiselect: 'select',
      radio: 'radio', checkbox: 'checkbox', hidden: 'df-hidden', currency: 'input',
    },
    typeProps: { multiselect: { multiple: true }, date: { type: 'date' } },
    ...overrides,
  };
}
