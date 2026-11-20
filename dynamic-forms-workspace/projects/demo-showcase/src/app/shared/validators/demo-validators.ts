import { DfValidatorDefinition } from '@core/dynamic-forms';
import { of, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

const NIFS_REGISTRADOS = new Set(['12345678Z', 'X1234567L']);

/**
 * Validadores que la app registra en el catálogo vía provideDynamicForms({ validators }).
 * El esquema los referencia por alias.
 */
export const DEMO_VALIDATORS: DfValidatorDefinition[] = [
  {
    name: 'nifDisponible',
    async: true,
    message: 'Ya existe un usuario con este documento',
    validate: (control) => {
      const value = String(control.value ?? '').trim().toUpperCase();
      if (!value) return of(true);
      // Simula GET {args.endpoint}?nif=...
      return timer(600).pipe(switchMap(() => of(!NIFS_REGISTRADOS.has(value))), map(Boolean));
    },
  },
  {
    name: 'mayorDeEdad',
    message: 'Debes tener al menos {{edad}} años',
    validate: (control, args) => {
      if (!control.value) return true;
      const minAge = Number(args?.['edad'] ?? 18);
      const birth = new Date(String(control.value));
      if (Number.isNaN(birth.getTime())) return false;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age >= minAge;
    },
  },
];
