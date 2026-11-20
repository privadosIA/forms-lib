import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { DfMaxLengthDirective } from '../../directives/max-length.directive';
import { DfMaxLengthMode, resolveMaxLengthMode } from '../../utils/text-length';

/** text | email | password | number | date */
@Component({
  selector: 'df-input-field',
  standalone: true,
  imports: [ReactiveFormsModule, FormlyModule, DfMaxLengthDirective],
  templateUrl: './input-field.component.html',
  styleUrl: './input-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputFieldComponent extends FieldType<FieldTypeConfig> {
  get inputType(): string {
    return (this.props['type'] as string | undefined) ?? 'text';
  }

  /** Modo de validation.maxLength (en 'weighted' la ñ y los acentos cuentan 2). */
  get mode(): DfMaxLengthMode {
    return resolveMaxLengthMode(this.props['maxLengthMode'], 'weighted');
  }
}
