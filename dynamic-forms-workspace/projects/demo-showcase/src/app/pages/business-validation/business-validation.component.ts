import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DfFormStatus, DfSubmitEvent, DynamicFormComponent } from '@core/dynamic-forms';
import { ModelViewerComponent } from '../../shared/model-viewer/model-viewer.component';
import { SchemaLoaderService } from '../../shared/schema-loader/schema-loader.service';

/**
 * Escenario 2: validadores de negocio del catálogo (dniNie, iban, phoneES, matchesField),
 * validadores registrados por la app (mayorDeEdad) y validación asíncrona (nifDisponible).
 */
@Component({
  selector: 'app-business-validation',
  standalone: true,
  imports: [DynamicFormComponent, ModelViewerComponent],
  templateUrl: './business-validation.component.html',
  styleUrl: './business-validation.component.scss',
})
export class BusinessValidationComponent {
  private readonly loader = inject(SchemaLoaderService);

  readonly schema = toSignal(this.loader.load('validacion-negocio'));
  readonly model = signal<Record<string, unknown>>({});
  readonly status = signal<DfFormStatus | ''>('');
  readonly lastSubmit = signal<unknown>(null);

  onSubmit(e: DfSubmitEvent): void {
    this.lastSubmit.set(e.model);
  }
}
