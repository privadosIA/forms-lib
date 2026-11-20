import { FormControl, FormGroup } from '@angular/forms';
import { DfValidatorDefinition } from '../models/config.model';
import {
  BUSINESS_VALIDATORS, isValidCif, isValidDni, isValidIban, isValidNie, isValidPhoneES, isValidPostalCodeES,
} from './business-validators';

const byName = (name: string): DfValidatorDefinition => BUSINESS_VALIDATORS.find((v) => v.name === name)!;

describe('Validadores de negocio', () => {
  describe('isValidDni', () => {
    it('acepta un DNI con letra de control correcta', () => {
      expect(isValidDni('12345678Z')).toBe(true);
    });
    it('normaliza minúsculas, espacios y guiones', () => {
      expect(isValidDni(' 12345678-z ')).toBe(true);
    });
    it('rechaza letra de control incorrecta o formato inválido', () => {
      expect(isValidDni('12345678A')).toBe(false);
      expect(isValidDni('1234567Z')).toBe(false);
      expect(isValidDni(null)).toBe(false);
    });
  });

  describe('isValidNie', () => {
    it('acepta un NIE válido', () => {
      expect(isValidNie('X1234567L')).toBe(true);
    });
    it('rechaza letra de control incorrecta o prefijo inválido', () => {
      expect(isValidNie('X1234567A')).toBe(false);
      expect(isValidNie('A1234567L')).toBe(false);
    });
  });

  describe('isValidCif', () => {
    it('acepta control numérico para tipos A, B, E, H', () => {
      expect(isValidCif('B12345674')).toBe(true);
      expect(isValidCif('B1234567D')).toBe(false);
    });
    it('exige control alfabético para tipos K, P, Q, S', () => {
      expect(isValidCif('Q1234567D')).toBe(true);
      expect(isValidCif('Q12345674')).toBe(false);
    });
    it('acepta letra o dígito para el resto de tipos', () => {
      expect(isValidCif('N12345674')).toBe(true);
      expect(isValidCif('N1234567D')).toBe(true);
    });
    it('rechaza formato inválido', () => {
      expect(isValidCif('I12345674')).toBe(false);
      expect(isValidCif('B1234567')).toBe(false);
    });
  });

  describe('isValidIban', () => {
    it('acepta un IBAN válido con o sin espacios', () => {
      expect(isValidIban('ES9121000418450200051332')).toBe(true);
      expect(isValidIban('ES91 2100 0418 4502 0005 1332')).toBe(true);
    });
    it('rechaza dígitos de control incorrectos', () => {
      expect(isValidIban('ES9021000418450200051332')).toBe(false);
      expect(isValidIban('ES91')).toBe(false);
    });
  });

  describe('isValidPhoneES', () => {
    it('acepta números de 9 dígitos que empiezan por 6, 7, 8 o 9', () => {
      ['612345678', '712345678', '812345678', '912345678'].forEach((n) => expect(isValidPhoneES(n)).toBe(true));
    });
    it('rechaza otros prefijos y longitudes', () => {
      expect(isValidPhoneES('512345678')).toBe(false);
      expect(isValidPhoneES('61234567')).toBe(false);
    });
  });

  describe('isValidPostalCodeES', () => {
    it('acepta provincias 01..52', () => {
      expect(isValidPostalCodeES('01001')).toBe(true);
      expect(isValidPostalCodeES('28001')).toBe(true);
      expect(isValidPostalCodeES('52001')).toBe(true);
    });
    it('rechaza provincias fuera de rango o longitudes incorrectas', () => {
      expect(isValidPostalCodeES('00001')).toBe(false);
      expect(isValidPostalCodeES('53001')).toBe(false);
      expect(isValidPostalCodeES('2800')).toBe(false);
    });
  });

  describe('BUSINESS_VALIDATORS', () => {
    it('registra los aliases del catálogo', () => {
      expect(BUSINESS_VALIDATORS.map((v) => v.name)).toEqual(
        expect.arrayContaining(['dni', 'nie', 'dniNie', 'cif', 'iban', 'phoneES', 'postalCodeES', 'matchesField']),
      );
    });

    it('considera válido un valor vacío (de eso se encarga required)', () => {
      BUSINESS_VALIDATORS.forEach((def) => {
        expect(def.validate(new FormControl(''), {}), def.name).toBe(true);
        expect(def.validate(new FormControl(null), {}), def.name).toBe(true);
      });
    });

    it('dniNie acepta tanto DNI como NIE', () => {
      const v = byName('dniNie');
      expect(v.validate(new FormControl('12345678Z'), {})).toBe(true);
      expect(v.validate(new FormControl('X1234567L'), {})).toBe(true);
      expect(v.validate(new FormControl('12345678A'), {})).toBe(false);
    });

    describe('matchesField', () => {
      const v = byName('matchesField');
      const form = () =>
        new FormGroup({
          email: new FormControl('a@b.es'),
          datos: new FormGroup({ confirmacion: new FormControl('') }),
        });

      it('es válido cuando coincide con el campo indicado', () => {
        const f = form();
        const c = f.get('datos.confirmacion')!;
        c.setValue('a@b.es');
        expect(v.validate(c, { field: 'email' })).toBe(true);
      });

      it('es inválido cuando no coincide', () => {
        const f = form();
        const c = f.get('datos.confirmacion')!;
        c.setValue('otro@b.es');
        expect(v.validate(c, { field: 'email' })).toBe(false);
      });

      it('resuelve claves con puntos', () => {
        const f = form();
        f.get('datos.confirmacion')!.setValue('x');
        const c = f.get('email')!;
        c.setValue('x');
        expect(v.validate(c, { field: 'datos.confirmacion' })).toBe(true);
      });

      it('es válido si no se indica field', () => {
        const c = form().get('email')!;
        expect(v.validate(c, {})).toBe(true);
      });
    });
  });
});
