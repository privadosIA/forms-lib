import { Directive, TemplateRef, inject, input } from '@angular/core';

/** Contexto de una plantilla de slot: `let-model` (el modelo raíz del formulario). */
export interface DfSlotContext {
  $implicit: Record<string, unknown>;
  model: Record<string, unknown>;
  /** `name` del nodo `slot`. */
  name: string;
}

/**
 * Plantilla propia que se pinta donde el esquema tiene un nodo `{ "type": "slot", "name": "resumen" }`, entre los
 * demás campos:
 *
 *   <dynamic-form [schema]="schema" [(model)]="model">
 *     <ng-template dfSlot="resumen" let-model><app-resumen [datos]="model" /></ng-template>
 *   </dynamic-form>
 */
@Directive({ selector: 'ng-template[dfSlot]', standalone: true })
export class DfSlotDirective {
  readonly name = input.required<string>({ alias: 'dfSlot' });
  readonly template = inject<TemplateRef<DfSlotContext>>(TemplateRef);
}

/** Clave de `options.formState` por la que `<dynamic-form>` entrega a los nodos `slot` sus plantillas. */
export const DF_SLOTS = 'dfSlots';

export interface DfSlots {
  get(name: string): TemplateRef<DfSlotContext> | null;
}
