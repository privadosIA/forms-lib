import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DfFormStatus, DfSubmitEvent, DynamicFormComponent } from '@core/dynamic-forms';
import { ModelViewerComponent } from '../../shared/model-viewer/model-viewer.component';
import { SchemaLoaderService } from '../../shared/schema-loader/schema-loader.service';

/**
 * Escenario 1: un select (tipoSolicitante) condiciona visibilidad y obligatoriedad
 * de campos secundarios con limpieza de estado (resetOnHide), más cascading selects
 * provincia → municipio (dependent) → barrio (remote).
 */
@Component({
  selector: 'app-dependent-fields',
  standalone: true,
  imports: [DynamicFormComponent, ModelViewerComponent],
  templateUrl: './dependent-fields.component.html',
  styleUrl: './dependent-fields.component.scss',
})
export class DependentFieldsComponent {
  private readonly loader = inject(SchemaLoaderService);

  readonly schema = toSignal(this.loader.load('solicitud-dependiente'));
  readonly model = signal<Record<string, unknown>>({ tipoSolicitante: 'fisica' });
  readonly status = signal<DfFormStatus | ''>('');
  readonly lastSubmit = signal<unknown>(null);

  onSubmit(e: DfSubmitEvent): void {
    this.lastSubmit.set(e.model);
  }

  onInvalid(e: DfSubmitEvent): void {
    console.warn('Formulario inválido', e.form.errors, e.model);
  }

  prefillJuridica(form: DynamicFormComponent): void {
    form.reset({ tipoSolicitante: 'juridica', razonSocial: 'ACME S.L.', provincia: '08', canal: 'postal' });
  }
}
