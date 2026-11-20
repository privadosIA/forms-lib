import { Injectable } from '@angular/core';
import { DfCondition, DfRule, DfRuleGroup } from '../models/schema.model';

/** Lee `a.b.c` de un objeto sin lanzar. */
export function getByPath(model: unknown, path: string): unknown {
  if (model == null || !path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, model);
}

/** Prefijo de una ruta que lee del contexto externo (`<dynamic-form [context]>`): `ctx.modo`. */
export const CONTEXT_PREFIX = 'ctx.';

/** Prefijo de una ruta relativa a la fila actual de una lista repetible: `./cantidad`. */
export const RELATIVE_PREFIX = './';

const isBlank = (v: unknown): boolean =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Evaluador declarativo (sin eval) del ConditionalLogicContract.
 */
@Injectable({ providedIn: 'root' })
export class ConditionEvaluatorService {
  /**
   * `model` es el modelo raíz. `local` es el objeto de la fila actual cuando la regla está dentro de una
   * lista repetible: las rutas `./campo` se leen de ahí. `context` es el objeto externo de la app: las rutas `ctx.nombre`
   * se leen de él. El resto de rutas, de `model`.
   */
  evaluate(rule: DfRule | undefined, model: unknown, local?: unknown, context?: unknown): boolean {
    if (!rule) return false;
    if (this.isCondition(rule)) return this.evaluateCondition(rule, model, local, context);
    return this.evaluateGroup(rule, model, local, context);
  }

  private isCondition(rule: DfRule): rule is DfCondition {
    return typeof (rule as DfCondition).field === 'string';
  }

  private evaluateGroup(group: DfRuleGroup, model: unknown, local: unknown, context: unknown): boolean {
    const checks: boolean[] = [];
    if (group.all) checks.push(group.all.every((r) => this.evaluate(r, model, local, context)));
    if (group.any) checks.push(group.any.some((r) => this.evaluate(r, model, local, context)));
    if (group.not) checks.push(!this.evaluate(group.not, model, local, context));
    return checks.length > 0 && checks.every(Boolean);
  }

  private evaluateCondition(c: DfCondition, model: unknown, local: unknown, context: unknown): boolean {
    const actual = c.field.startsWith(RELATIVE_PREFIX)
      ? getByPath(local, c.field.slice(RELATIVE_PREFIX.length))
      : c.field.startsWith(CONTEXT_PREFIX)
        ? getByPath(context, c.field.slice(CONTEXT_PREFIX.length))
        : getByPath(model, c.field);
    const expected = c.value;
    switch (c.operator) {
      case 'eq': return actual === expected || (isBlank(actual) && isBlank(expected));
      case 'neq': return !(actual === expected || (isBlank(actual) && isBlank(expected)));
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'nin': return Array.isArray(expected) && !expected.includes(actual);
      case 'gt': return Number(actual) > Number(expected);
      case 'gte': return Number(actual) >= Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      case 'lte': return Number(actual) <= Number(expected);
      case 'empty': return isBlank(actual);
      case 'notEmpty': return !isBlank(actual);
      case 'truthy': return !!actual;
      case 'falsy': return !actual;
      case 'matches':
        try {
          return typeof expected === 'string' && new RegExp(expected).test(String(actual ?? ''));
        } catch {
          return false;
        }
      case 'contains':
        if (Array.isArray(actual)) return actual.includes(expected);
        return typeof actual === 'string' && actual.includes(String(expected));
      default:
        return false;
    }
  }
}
