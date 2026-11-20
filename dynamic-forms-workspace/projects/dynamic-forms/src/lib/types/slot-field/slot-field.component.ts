import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef } from '@angular/core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { DF_SLOTS, DfSlotContext, DfSlots } from '../../directives/slot.directive';
import { rootModel } from '../../utils/model-path';

/** Nodo `slot`: no es un control ni toca el modelo, solo pinta la plantilla de la app con ese nombre. */
@Component({
  selector: 'df-slot-field',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `@if (template; as tpl) {<ng-container *ngTemplateOutlet="tpl; context: context" />}`,
  // El modelo cambia sin que Formly avise a este componente: se revisa en cada pasada.
  changeDetection: ChangeDetectionStrategy.Default,
})
export class SlotFieldComponent extends FieldType<FormlyFieldConfig> {
  get name(): string {
    return this.props['slotName'] as string;
  }

  get template(): TemplateRef<DfSlotContext> | null {
    return (this.options?.formState?.[DF_SLOTS] as DfSlots | undefined)?.get(this.name) ?? null;
  }

  get context(): DfSlotContext {
    const model = rootModel(this.field) as Record<string, unknown>;
    return { $implicit: model, model, name: this.name };
  }
}
