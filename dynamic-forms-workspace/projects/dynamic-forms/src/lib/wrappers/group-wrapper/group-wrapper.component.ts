import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldWrapper } from '@ngx-formly/core';

/** Fieldset con título/descripción para nodos de tipo group. */
@Component({
  selector: 'df-group-wrapper',
  standalone: true,
  templateUrl: './group-wrapper.component.html',
  styleUrl: './group-wrapper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupWrapperComponent extends FieldWrapper {}
