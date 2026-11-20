import { FormlyFieldConfig } from '@ngx-formly/core';
import { RELATIVE_PREFIX, getByPath } from '../services/condition-evaluator.service';

/** Modelo raíz del formulario desde cualquier campo (los grupos no tienen key). */
export function rootModel(field: FormlyFieldConfig): unknown {
  let f: FormlyFieldConfig = field;
  while (f.parent) f = f.parent;
  return f.model;
}

/** Lee la ruta de un campo: `./campo` de la fila que contiene a `field`; cualquier otra, del modelo raíz. */
export function readPath(field: FormlyFieldConfig, path: string): unknown {
  return path.startsWith(RELATIVE_PREFIX)
    ? getByPath(field.model, path.slice(RELATIVE_PREFIX.length))
    : getByPath(rootModel(field), path);
}

/** El nombre de un parámetro: la ruta sin el `./` de las relativas. */
export const paramName = (path: string): string => (path.startsWith(RELATIVE_PREFIX) ? path.slice(RELATIVE_PREFIX.length) : path);

/** Clave de `options.formState` por la que `<dynamic-form>` entrega su `context` a los campos y las tablas. */
export const DF_CONTEXT_KEY = 'dfContext';

/** Contexto externo del formulario (`<dynamic-form [context]>`), para las rutas `ctx.nombre` de las condiciones. */
export function contextOf(field: FormlyFieldConfig): unknown {
  return (field.options?.formState as Record<string, unknown> | undefined)?.[DF_CONTEXT_KEY];
}
