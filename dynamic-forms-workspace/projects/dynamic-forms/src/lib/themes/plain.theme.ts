import { DfTheme } from '../models/config.model';
import {
  CheckboxFieldComponent, CurrencyFieldComponent, HiddenFieldComponent, InputFieldComponent, RadioFieldComponent,
  RepeatFieldComponent, SelectFieldComponent, SlotFieldComponent, TableFieldComponent, TextareaFieldComponent,
} from '../types';
import { FieldWrapperComponent, GroupWrapperComponent } from '../wrappers';

export const DF_PLAIN_TYPE_NAMES = {
  input: 'df-input',
  select: 'df-select',
  textarea: 'df-textarea',
  checkbox: 'df-checkbox',
  radio: 'df-radio',
  hidden: 'df-hidden',
  currency: 'df-currency',
  repeat: 'df-repeat',
  table: 'df-table',
  slot: 'df-slot',
} as const;

/**
 * Tema por defecto: sin dependencias de UI, componentes propios de la librería.
 * Estilos: @use '@core/dynamic-forms/styles/plain';
 */
export const PLAIN_THEME: DfTheme = {
  name: 'plain',
  hostClass: 'df-theme-plain',
  fieldWrappers: ['df-field'],
  groupWrapper: 'df-group',
  typeMap: {
    text: DF_PLAIN_TYPE_NAMES.input,
    email: DF_PLAIN_TYPE_NAMES.input,
    password: DF_PLAIN_TYPE_NAMES.input,
    number: DF_PLAIN_TYPE_NAMES.input,
    date: DF_PLAIN_TYPE_NAMES.input,
    textarea: DF_PLAIN_TYPE_NAMES.textarea,
    select: DF_PLAIN_TYPE_NAMES.select,
    multiselect: DF_PLAIN_TYPE_NAMES.select,
    radio: DF_PLAIN_TYPE_NAMES.radio,
    checkbox: DF_PLAIN_TYPE_NAMES.checkbox,
    hidden: DF_PLAIN_TYPE_NAMES.hidden,
    currency: DF_PLAIN_TYPE_NAMES.currency,
  },
  formlyConfig: {
    types: [
      { name: DF_PLAIN_TYPE_NAMES.input, component: InputFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.select, component: SelectFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.textarea, component: TextareaFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.checkbox, component: CheckboxFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.radio, component: RadioFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.hidden, component: HiddenFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.currency, component: CurrencyFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.repeat, component: RepeatFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.table, component: TableFieldComponent },
      { name: DF_PLAIN_TYPE_NAMES.slot, component: SlotFieldComponent },
    ],
    wrappers: [
      { name: 'df-field', component: FieldWrapperComponent },
      { name: 'df-group', component: GroupWrapperComponent },
    ],
  },
};
