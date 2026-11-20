import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';

/** Mantiene el valor en el modelo sin pintarse (ids de proceso, tokens…). */
@Component({
  selector: 'df-hidden-field',
  standalone: true,
  imports: [ReactiveFormsModule, FormlyModule],
  templateUrl: './hidden-field.component.html',
  styleUrl: './hidden-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HiddenFieldComponent extends FieldType<FieldTypeConfig> {}
