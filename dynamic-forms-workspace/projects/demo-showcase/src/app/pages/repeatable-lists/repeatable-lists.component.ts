import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DfFormStatus, DfSubmitEvent, DynamicFormComponent } from '@core/dynamic-forms';
import { ModelViewerComponent } from '../../shared/model-viewer/model-viewer.component';
import { SchemaLoaderService } from '../../shared/schema-loader/schema-loader.service';

/**
 * Escenario 4: listas repetibles (`type: "array"`). Una tabla de líneas y una lista de contactos
 * en tarjetas, con reglas relativas a la fila (./campo) combinadas con reglas de la raíz.
 */
@Component({
  selector: 'app-repeatable-lists',
  standalone: true,
  imports: [DynamicFormComponent, ModelViewerComponent],
  templateUrl: './repeatable-lists.component.html',
  styleUrl: './repeatable-lists.component.scss',
})
export class RepeatableListsComponent {
  private readonly loader = inject(SchemaLoaderService);

  readonly schema = toSignal(this.loader.load('listas-repetibles'));
  readonly model = signal<Record<string, unknown>>({});
  readonly status = signal<DfFormStatus | ''>('');
  readonly lastSubmit = signal<unknown>(null);

  onSubmit(e: DfSubmitEvent): void {
    this.lastSubmit.set(e.model);
  }

  onInvalid(e: DfSubmitEvent): void {
    console.warn('Formulario inválido', e.form.errors, e.model);
  }

  prefill(form: DynamicFormComponent): void {
    form.reset({
      cliente: 'ACME S.L.',
      aplicaDescuento: true,
      lineas: [
        { concepto: 'Teclado mecánico', cantidad: 12, precio: 89.9 },
        { concepto: 'Ratón', cantidad: 2, precio: 24.5 },
      ],
      contactos: [{ nombre: 'Marta Pérez', telefono: '612345678', principal: true, cargo: 'Compras' }],
    });
  }
}
