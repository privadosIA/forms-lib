import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

/** La label se pinta aquí (el wrapper la oculta con hideLabel). */
@Component({
  selector: 'df-checkbox-field',
  standalone: true,
  imports: [ReactiveFormsModule, FormlyModule],
  templateUrl: './checkbox-field.component.html',
  styleUrl: './checkbox-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxFieldComponent extends FieldType<FieldTypeConfig> {}
