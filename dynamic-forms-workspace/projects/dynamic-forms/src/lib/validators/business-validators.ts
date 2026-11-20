import { AbstractControl } from '@angular/forms';
import { DfValidatorDefinition } from '../models/config.model';

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

const normalize = (v: unknown): string => (v == null ? '' : String(v)).trim().toUpperCase().replace(/[\s-]/g, '');

/** Un valor vacío siempre es válido: de "obligatorio" se encarga `required`. */
const isEmpty = (c: AbstractControl): boolean => c.value == null || c.value === '';

export function isValidDni(raw: unknown): boolean {
  const v = normalize(raw);
  if (!/^\d{8}[A-Z]$/.test(v)) return false;
  return DNI_LETTERS[Number(v.slice(0, 8)) % 23] === v[8];
}

export function isValidNie(raw: unknown): boolean {
  const v = normalize(raw);
  if (!/^[XYZ]\d{7}[A-Z]$/.test(v)) return false;
  const prefix = { X: '0', Y: '1', Z: '2' }[v[0] as 'X' | 'Y' | 'Z'];
  return DNI_LETTERS[Number(prefix + v.slice(1, 8)) % 23] === v[8];
}

export function isValidCif(raw: unknown): boolean {
  const v = normalize(raw);
  if (!/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) return false;
  const digits = v.slice(1, 8);
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const d = n * 2;
      sum += d > 9 ? d - 9 : d;
    } else {
      sum += n;
    }
  }
  const controlDigit = (10 - (sum % 10)) % 10;
  const controlLetter = 'JABCDEFGHI'[controlDigit];
  const control = v[8];
  const letterOnly = /^[KPQS]$/.test(v[0]);
  const digitOnly = /^[ABEH]$/.test(v[0]);
  if (letterOnly) return control === controlLetter;
  if (digitOnly) return control === String(controlDigit);
  return control === controlLetter || control === String(controlDigit);
}

export function isValidIban(raw: unknown): boolean {
  const v = normalize(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  const rearranged = v.slice(4) + v.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}

export const isValidPhoneES = (raw: unknown): boolean => /^[6789]\d{8}$/.test(normalize(raw));

export function isValidPostalCodeES(raw: unknown): boolean {
  const v = normalize(raw);
  if (!/^\d{5}$/.test(v)) return false;
  const province = Number(v.slice(0, 2));
  return province >= 1 && province <= 52;
}

export const BUSINESS_VALIDATORS: DfValidatorDefinition[] = [
  { name: 'dni', message: 'El DNI no es válido', validate: (c) => isEmpty(c) || isValidDni(c.value) },
  { name: 'nie', message: 'El NIE no es válido', validate: (c) => isEmpty(c) || isValidNie(c.value) },
  {
    name: 'dniNie',
    message: 'El documento no es válido',
    validate: (c) => isEmpty(c) || isValidDni(c.value) || isValidNie(c.value),
  },
  { name: 'cif', message: 'El CIF no es válido', validate: (c) => isEmpty(c) || isValidCif(c.value) },
  { name: 'iban', message: 'El IBAN no es válido', validate: (c) => isEmpty(c) || isValidIban(c.value) },
  { name: 'phoneES', message: 'El teléfono no es válido', validate: (c) => isEmpty(c) || isValidPhoneES(c.value) },
  {
    name: 'postalCodeES',
    message: 'El código postal no es válido',
    validate: (c) => isEmpty(c) || isValidPostalCodeES(c.value),
  },
  {
    name: 'matchesField',
    message: 'Los valores no coinciden',
    validate: (c, args) => {
      const other = args?.['field'];
      if (typeof other !== 'string' || isEmpty(c)) return true;
      return c.value === c.root.get(other.split('.'))?.value;
    },
  },
];
