import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DfFormStatus, DfSubmitEvent, DynamicFormComponent } from '@core/dynamic-forms';
import { ModelViewerComponent } from '../../shared/model-viewer/model-viewer.component';
import { SchemaLoaderService } from '../../shared/schema-loader/schema-loader.service';

/**
 * Escenario 3: el esquema llega de un servicio externo (GET /api/forms/:id) en lugar
 * de un fichero estático. El servicio lo simula `mockBackendInterceptor`.
 */
@Component({
  selector: 'app-remote-schema',
  standalone: true,
  imports: [DynamicFormComponent, ModelViewerComponent],
  templateUrl: './remote-schema.component.html',
  styleUrl: './remote-schema.component.scss',
})
export class RemoteSchemaComponent {
  private readonly loader = inject(SchemaLoaderService);

  readonly ids = ['alta-cliente', 'encuesta-satisfaccion', 'no-existe', 'error'];
  readonly formId = signal(this.ids[0]);
  readonly schema = rxResource({
    params: () => this.formId(),
    stream: ({ params }) => this.loader.loadRemote(params),
  });

  readonly model = signal<Record<string, unknown>>({});
  readonly status = signal<DfFormStatus | ''>('');
  readonly lastSubmit = signal<unknown>(null);

  select(id: string): void {
    this.model.set({});
    this.lastSubmit.set(null);
    this.formId.set(id);
  }

  errorMessage(): string {
    const err = this.schema.error();
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    return status === 404 ? 'El servidor no tiene un formulario con ese id (404).' : `No se pudo cargar el formulario (${status || 'error'}).`;
  }

  onSubmit(e: DfSubmitEvent): void {
    this.lastSubmit.set(e.model);
  }
}
