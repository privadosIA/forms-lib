import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { Observable, isObservable, of } from 'rxjs';
import { DfOption } from '../../models/schema.model';

/** select | multiselect — acepta options estáticas u Observable (remote/cascading). */
@Component({
  selector: 'df-select-field',
  standalone: true,
  imports: [ReactiveFormsModule, FormlyModule, AsyncPipe],
  templateUrl: './select-field.component.html',
  styleUrl: './select-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectFieldComponent extends FieldType<FieldTypeConfig> {
  private lastRaw: unknown;
  private lastObs: Observable<DfOption[]> = of([]);

  get options$(): Observable<DfOption[]> {
    const raw = this.props.options as unknown;
    if (raw !== this.lastRaw) {
      this.lastRaw = raw;
      this.lastObs = isObservable(raw) ? (raw as Observable<DfOption[]>) : of((raw as DfOption[]) ?? []);
    }
    return this.lastObs;
  }

  get multiple(): boolean {
    return this.props['multiple'] === true;
  }

  trackValue(_: number, o: DfOption): unknown {
    return o.value;
  }

  /**
   * Valor de la opción del placeholder: el mismo "vacío" que tenga el modelo (undefined al empezar,
   * null tras un reset en cascada) para que quede seleccionada. Con [ngValue]="null" fijo, un campo
   * sin valor se pintaba en blanco.
   */
  get placeholderValue(): null | undefined {
    return this.formControl.value === undefined ? undefined : null;
  }
}
