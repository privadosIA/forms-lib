import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldWrapper, FormlyModule } from '@ngx-formly/core';

/** Wrapper estándar: label, control proyectado, descripción y mensajes de error. */
@Component({
  selector: 'df-field-wrapper',
  standalone: true,
  imports: [FormlyModule],
  templateUrl: './field-wrapper.component.html',
  styleUrl: './field-wrapper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldWrapperComponent extends FieldWrapper {
  get showLabel(): boolean {
    return !!this.props.label && this.props['hideLabel'] !== true;
  }
}
