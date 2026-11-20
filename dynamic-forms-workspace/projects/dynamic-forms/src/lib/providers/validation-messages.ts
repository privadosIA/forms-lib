import { FormlyFieldConfig } from '@ngx-formly/core';
import { DfValidationMessage } from '../models/config.model';
import { DfNumberFormat, amountExample } from '../utils/currency';

type Err = Record<string, unknown>;

/** Mensajes built-in (ValidationContract.builtIn). */
export const DEFAULT_VALIDATION_MESSAGES: Record<string, DfValidationMessage> = {
  required: 'Este campo es obligatorio',
  email: 'Debe ser un email válido',
  pattern: 'El formato no es válido',
  min: (e: unknown) => `El valor mínimo es ${(e as Err)['min']}`,
  max: (e: unknown) => `El valor máximo es ${(e as Err)['max']}`,
  minLength: (e: unknown) => `Mínimo ${(e as Err)['requiredLength']} caracteres`,
  maxLength: (e: unknown) => `Máximo ${(e as Err)['requiredLength']} caracteres`,
  // El ejemplo sigue el formato del campo: 1.500,75 (es) o 1,500.75 (en).
  minItems: (_e: unknown, field: FormlyFieldConfig) => `Añade al menos ${field.props?.['minItems']} elemento(s)`,
  maxItems: (_e: unknown, field: FormlyFieldConfig) => `No puede haber más de ${field.props?.['maxItems']} elemento(s)`,
  currencyFormat: (_e: unknown, field: FormlyFieldConfig) =>
    `El importe no tiene un formato válido (p. ej. ${amountExample(field.props?.['numberFormat'] as DfNumberFormat)})`,
  currencyDecimals: 'El importe no puede tener más de dos decimales',
};

/** Juego completo en inglés: `provideDynamicForms({ messages: EN_VALIDATION_MESSAGES })`. */
export const EN_VALIDATION_MESSAGES: Record<string, DfValidationMessage> = {
  required: 'This field is required',
  email: 'Must be a valid email',
  pattern: 'The format is not valid',
  min: (e: unknown) => `The minimum value is ${(e as Err)['min']}`,
  max: (e: unknown) => `The maximum value is ${(e as Err)['max']}`,
  minLength: (e: unknown) => `At least ${(e as Err)['requiredLength']} characters`,
  maxLength: (e: unknown) => `At most ${(e as Err)['requiredLength']} characters`,
  minItems: (_e: unknown, field: FormlyFieldConfig) => `Add at least ${field.props?.['minItems']} item(s)`,
  maxItems: (_e: unknown, field: FormlyFieldConfig) => `There can be no more than ${field.props?.['maxItems']} item(s)`,
  currencyFormat: (_e: unknown, field: FormlyFieldConfig) =>
    `The amount is not in a valid format (e.g. ${amountExample(field.props?.['numberFormat'] as DfNumberFormat)})`,
  currencyDecimals: 'The amount cannot have more than two decimals',
};

export function toFormlyMessages(
  messages: Record<string, DfValidationMessage>,
): { name: string; message: string | ((error: unknown, field: FormlyFieldConfig) => string) }[] {
  return Object.entries(messages).map(([name, message]) => ({ name, message }));
}
