import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import { DfMaxLengthDirective } from '../../directives/max-length.directive';
import { DfMaxLengthMode, resolveMaxLengthMode, textLength } from '../../utils/text-length';

@Component({
  selector: 'df-textarea-field',
  standalone: true,
  imports: [ReactiveFormsModule, FormlyModule, DfMaxLengthDirective],
  templateUrl: './textarea-field.component.html',
  styleUrl: './textarea-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextareaFieldComponent extends FieldType<FieldTypeConfig> {
  get rows(): number {
    return (this.props['rows'] as number | undefined) ?? 3;
  }

  /**
   * Con validation.maxLength se pinta el contador "N/máx" bajo la caja y se bloquea en el límite.
   * En modo 'weighted' (por defecto) la ñ y los acentos cuentan 2, igual que en el validador.
   */
  get maxLength(): number | undefined {
    return this.props.maxLength;
  }

  get mode(): DfMaxLengthMode {
    return resolveMaxLengthMode(this.props['maxLengthMode'], 'weighted');
  }

  get length(): number {
    return textLength(String(this.formControl.value ?? ''), this.mode);
  }
}
