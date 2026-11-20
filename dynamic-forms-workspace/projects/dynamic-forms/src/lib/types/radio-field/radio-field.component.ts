import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { Observable, isObservable, of } from 'rxjs';
import { DfOption } from '../../models/schema.model';

/**
 * Sin [formControl]: con el value accessor de Angular, [disabled] en el input lo
 * captura FormControlDirective y las opciones deshabilitadas seguían pulsables.
 */
@Component({
  selector: 'df-radio-field',
  standalone: true,
  imports: [FormlyModule, AsyncPipe],
  templateUrl: './radio-field.component.html',
  styleUrl: './radio-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioFieldComponent extends FieldType<FieldTypeConfig> {
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

  get inline(): boolean {
    return this.props['inline'] === true;
  }

  isDisabled(opt: DfOption): boolean {
    return opt.disabled === true || this.formControl.disabled;
  }

  select(value: DfOption['value']): void {
    this.formControl.setValue(value);
    this.formControl.markAsDirty();
  }
}
