import { TestBed } from '@angular/core/testing';
import { DfValidatorDefinition } from '../models/config.model';
import { DF_VALIDATORS } from '../tokens/dynamic-forms.tokens';
import { ValidatorRegistryService } from './validator-registry.service';

const def = (name: string, message = name): DfValidatorDefinition => ({ name, message, validate: () => true });

describe('ValidatorRegistryService', () => {
  it('arranca vacío si no hay DF_VALIDATORS', () => {
    const service = TestBed.inject(ValidatorRegistryService);
    expect(service.names()).toEqual([]);
    expect(service.has('dni')).toBe(false);
    expect(service.get('dni')).toBeUndefined();
  });

  it('registra todos los grupos del token multi DF_VALIDATORS', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DF_VALIDATORS, multi: true, useValue: [def('a'), def('b')] },
        { provide: DF_VALIDATORS, multi: true, useValue: [def('c')] },
      ],
    });
    const service = TestBed.inject(ValidatorRegistryService);
    expect(service.names()).toEqual(['a', 'b', 'c']);
  });

  it('un registro posterior con el mismo nombre sobrescribe al anterior', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DF_VALIDATORS, multi: true, useValue: [def('a', 'original')] },
        { provide: DF_VALIDATORS, multi: true, useValue: [def('a', 'app')] },
      ],
    });
    const service = TestBed.inject(ValidatorRegistryService);
    expect(service.names()).toEqual(['a']);
    expect(service.get('a')?.message).toBe('app');
  });

  it('admite registro en tiempo de ejecución', () => {
    const service = TestBed.inject(ValidatorRegistryService);
    const nuevo = def('mayorDeEdad');
    service.register(nuevo);
    expect(service.has('mayorDeEdad')).toBe(true);
    expect(service.get('mayorDeEdad')).toBe(nuevo);
  });

  it('lanza si la definición no tiene name', () => {
    const service = TestBed.inject(ValidatorRegistryService);
    expect(() => service.register({ ...def('x'), name: '' })).toThrowError(/name/);
    expect(() => service.register(undefined as unknown as DfValidatorDefinition)).toThrowError(/name/);
  });
});
