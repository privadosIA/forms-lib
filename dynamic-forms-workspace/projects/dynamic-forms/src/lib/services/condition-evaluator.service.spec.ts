import { TestBed } from '@angular/core/testing';
import { DfRule } from '../models/schema.model';
import { ConditionEvaluatorService, getByPath } from './condition-evaluator.service';

describe('getByPath', () => {
  it('lee rutas con puntos', () => {
    expect(getByPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
  });
  it('devuelve undefined sin lanzar si la ruta no existe', () => {
    expect(getByPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(getByPath(null, 'a')).toBeUndefined();
    expect(getByPath({ a: 1 }, '')).toBeUndefined();
  });
});

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;
  const evalOp = (operator: string, actual: unknown, value?: unknown) =>
    service.evaluate({ field: 'x', operator, value } as DfRule, { x: actual });

  beforeEach(() => {
    service = TestBed.inject(ConditionEvaluatorService);
  });

  it('las rutas ctx. leen del contexto, también dentro de all/any/not y mezcladas con ./ y el modelo', () => {
    const ctx = { modo: 'edicion', usuario: { rol: 'admin' } };
    const rule = { all: [
      { field: 'ctx.modo', operator: 'eq', value: 'edicion' },
      { field: 'ctx.usuario.rol', operator: 'eq', value: 'admin' },
      { field: './n', operator: 'gt', value: 1 },
      { field: 'x', operator: 'eq', value: 'a' },
      { not: { field: 'ctx.falta', operator: 'truthy' } },
    ] } as DfRule;
    expect(service.evaluate(rule, { x: 'a' }, { n: 2 }, ctx)).toBe(true);
    expect(service.evaluate(rule, { x: 'a' }, { n: 2 }, { ...ctx, modo: 'lectura' })).toBe(false);
    expect(service.evaluate({ field: 'ctx.modo', operator: 'empty' } as DfRule, { modo: 'edicion' })).toBe(true); // sin contexto, vacío
  });

  it('devuelve false sin regla', () => {
    expect(service.evaluate(undefined, {})).toBe(false);
  });

  describe('operadores', () => {
    it('eq / neq, tratando vacíos como equivalentes', () => {
      expect(evalOp('eq', 'a', 'a')).toBe(true);
      expect(evalOp('eq', 'a', 'b')).toBe(false);
      expect(evalOp('eq', undefined, '')).toBe(true);
      expect(evalOp('eq', [], null)).toBe(true);
      expect(evalOp('neq', 'a', 'b')).toBe(true);
      expect(evalOp('neq', null, '')).toBe(false);
    });

    it('in / nin', () => {
      expect(evalOp('in', 'b', ['a', 'b'])).toBe(true);
      expect(evalOp('in', 'c', ['a', 'b'])).toBe(false);
      expect(evalOp('in', 'a', 'a')).toBe(false);
      expect(evalOp('nin', 'c', ['a', 'b'])).toBe(true);
      expect(evalOp('nin', 'a', ['a', 'b'])).toBe(false);
    });

    it('gt / gte / lt / lte con coerción numérica', () => {
      expect(evalOp('gt', '18', 17)).toBe(true);
      expect(evalOp('gt', 17, 17)).toBe(false);
      expect(evalOp('gte', 17, 17)).toBe(true);
      expect(evalOp('lt', 16, '17')).toBe(true);
      expect(evalOp('lte', 17, 17)).toBe(true);
      expect(evalOp('lte', 18, 17)).toBe(false);
    });

    it('empty / notEmpty', () => {
      expect(evalOp('empty', '')).toBe(true);
      expect(evalOp('empty', [])).toBe(true);
      expect(evalOp('empty', undefined)).toBe(true);
      expect(evalOp('empty', 0)).toBe(false);
      expect(evalOp('notEmpty', 'a')).toBe(true);
      expect(evalOp('notEmpty', null)).toBe(false);
    });

    it('truthy / falsy', () => {
      expect(evalOp('truthy', true)).toBe(true);
      expect(evalOp('truthy', 0)).toBe(false);
      expect(evalOp('falsy', '')).toBe(true);
      expect(evalOp('falsy', 'a')).toBe(false);
    });

    it('matches con regex y sin lanzar ante regex inválida', () => {
      expect(evalOp('matches', 'ES123', '^ES')).toBe(true);
      expect(evalOp('matches', 'FR123', '^ES')).toBe(false);
      expect(evalOp('matches', undefined, '^$')).toBe(true);
      expect(evalOp('matches', 'a', '(')).toBe(false);
      expect(evalOp('matches', 'a', 1)).toBe(false);
    });

    it('contains sobre arrays y strings', () => {
      expect(evalOp('contains', ['a', 'b'], 'b')).toBe(true);
      expect(evalOp('contains', ['a'], 'b')).toBe(false);
      expect(evalOp('contains', 'hola mundo', 'mundo')).toBe(true);
      expect(evalOp('contains', 5, 5)).toBe(false);
    });

    it('operador desconocido devuelve false', () => {
      expect(evalOp('foo', 1, 1)).toBe(false);
    });
  });

  it('resuelve campos con puntos contra el modelo raíz', () => {
    const rule: DfRule = { field: 'direccion.pais', operator: 'eq', value: 'ES' };
    expect(service.evaluate(rule, { direccion: { pais: 'ES' } })).toBe(true);
  });

  describe('grupos', () => {
    const model = { a: 1, b: 2 };
    const a1: DfRule = { field: 'a', operator: 'eq', value: 1 };
    const b3: DfRule = { field: 'b', operator: 'eq', value: 3 };

    it('all exige que se cumplan todas', () => {
      expect(service.evaluate({ all: [a1] }, model)).toBe(true);
      expect(service.evaluate({ all: [a1, b3] }, model)).toBe(false);
    });

    it('any exige que se cumpla alguna', () => {
      expect(service.evaluate({ any: [a1, b3] }, model)).toBe(true);
      expect(service.evaluate({ any: [b3] }, model)).toBe(false);
    });

    it('not niega la regla', () => {
      expect(service.evaluate({ not: b3 }, model)).toBe(true);
      expect(service.evaluate({ not: a1 }, model)).toBe(false);
    });

    it('combina all, any y not en el mismo grupo con AND', () => {
      expect(service.evaluate({ all: [a1], any: [a1, b3], not: b3 }, model)).toBe(true);
      expect(service.evaluate({ all: [a1], not: a1 }, model)).toBe(false);
    });

    it('anida grupos', () => {
      expect(service.evaluate({ any: [{ all: [a1, { not: b3 }] }, b3] }, model)).toBe(true);
    });

    it('un grupo vacío devuelve false', () => {
      expect(service.evaluate({} as DfRule, model)).toBe(false);
    });
  });

  describe('rutas relativas (./campo)', () => {
    const root = { tipo: 'a', fila: { cantidad: 5 } };

    it('lee ./campo de la fila y el resto de la raíz', () => {
      const rule: DfRule = { all: [{ field: './cantidad', operator: 'gt', value: 3 }, { field: 'tipo', operator: 'eq', value: 'a' }] };
      expect(service.evaluate(rule, root, root.fila)).toBe(true);
      expect(service.evaluate(rule, root, { cantidad: 1 })).toBe(false);
    });

    it('sin fila, una ruta relativa no encuentra nada', () => {
      expect(service.evaluate({ field: './cantidad', operator: 'empty' }, root)).toBe(true);
    });
  });
});
