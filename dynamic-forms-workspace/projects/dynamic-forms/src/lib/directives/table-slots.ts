import { Directive, TemplateRef, inject, input } from '@angular/core';

/** Contexto de una plantilla de celda: `let-row`, o `let-value="value"` y `let-column="column"`. */
export interface DfCellContext {
  $implicit: Record<string, unknown>;
  row: Record<string, unknown>;
  /** Valor de la propiedad de la columna en esa fila. */
  value: unknown;
  /** `key` de la columna. */
  column: string;
}

/**
 * Plantilla propia para las celdas de las columnas con `template: "nombre"`:
 *
 *   <dynamic-form [schema]="schema">
 *     <ng-template dfCell="estado" let-row let-value="value"><app-estado [value]="value" /></ng-template>
 *   </dynamic-form>
 */
@Directive({ selector: 'ng-template[dfCell]', standalone: true })
export class DfCellDirective {
  readonly name = input.required<string>({ alias: 'dfCell' });
  readonly template = inject<TemplateRef<DfCellContext>>(TemplateRef);
}

/**
 * Plantilla propia para una tabla sin filas (en lugar de `emptyMessage`). `dfEmpty="id"` es para la tabla con ese `id`;
 * sin valor vale para todas las que no tengan una propia. El contexto es `let-table` (el `id` de la tabla).
 */
@Directive({ selector: 'ng-template[dfEmpty]', standalone: true })
export class DfEmptyDirective {
  readonly table = input<string>('', { alias: 'dfEmpty' });
  readonly template = inject<TemplateRef<{ $implicit: string }>>(TemplateRef);
}

/** Clave de `options.formState` por la que `<dynamic-form>` entrega a las tablas sus plantillas. */
export const DF_TABLE_SLOTS = 'dfTableSlots';

export interface DfTableSlots {
  cell(name: string): TemplateRef<DfCellContext> | null;
  empty(tableId: string): TemplateRef<{ $implicit: string }> | null;
}
