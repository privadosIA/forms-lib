import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DfFormStatus, DfSubmitEvent, DfTableActionEvent, DfTableSelectEvent, DynamicFormComponent } from '@core/dynamic-forms';
import { ModelViewerComponent } from '../../shared/model-viewer/model-viewer.component';
import { SchemaLoaderService } from '../../shared/schema-loader/schema-loader.service';

const REPRESENTANTES = [
  { titular: { nombre: 'Marta Pérez', nif: '12345678Z' }, desde: '2023-05-10T09:00:00', vigente: true, estado: '<span class="df-badge df-badge--ok">Vigente</span>', ficha: '<a href="https://example.com/marta" target="_blank" rel="noopener">Ver ficha</a>' },
  { titular: { nombre: 'Construcciones Ñandú S.L.', nif: 'B12345674' }, desde: '2021-11-02', vigente: false, estado: '<span class="df-badge df-badge--error">Revocado</span>', ficha: '<a href="https://example.com/nandu" target="_blank" rel="noopener">Ver ficha</a>' },
  { titular: { nombre: 'Álvaro Núñez', nif: 'X1234567L' }, desde: '2024-02-20T16:30:00', vigente: true, estado: '<span class="df-badge df-badge--warn">Pendiente</span>', ficha: '<a href="https://example.com/alvaro" target="_blank" rel="noopener">Ver ficha</a>' },
];

/**
 * Escenario 5: tablas de datos (`type: "table"`). Solo lectura: las filas vienen del esquema o de una
 * propiedad del modelo, y las acciones y la selección llegan como eventos del formulario.
 */
@Component({
  selector: 'app-data-tables',
  standalone: true,
  imports: [DynamicFormComponent, ModelViewerComponent],
  templateUrl: './data-tables.component.html',
  styleUrl: './data-tables.component.scss',
})
export class DataTablesComponent {
  private readonly loader = inject(SchemaLoaderService);

  readonly schema = toSignal(this.loader.load('tablas-datos'));
  readonly criteriosSchema = toSignal(this.loader.load('busqueda-criterios'));
  readonly resultadosSchema = toSignal(this.loader.load('busqueda-resultados'));
  readonly model = signal<Record<string, unknown>>({});
  readonly status = signal<DfFormStatus | ''>('');
  readonly events = signal<string[]>([]);
  /** Criterios ya aplicados: lo que lee la tabla de resultados. Cambia solo al pulsar «Buscar»; arranca con los valores por defecto del formulario. */
  readonly criterios = signal<Record<string, unknown>>({ q: '', estado: 'todos' });

  buscar(e: DfSubmitEvent): void {
    this.criterios.set({ ...e.model });
  }

  loadRepresentantes(): void {
    this.model.update((m) => ({ ...m, representantes: structuredClone(REPRESENTANTES) }));
  }

  clearRepresentantes(): void {
    this.model.update((m) => ({ ...m, representantes: [] }));
  }

  onAction(e: DfTableActionEvent): void {
    this.log(`Acción «${e.action}» en ${e.tableId}: ${JSON.stringify(e.row)}`);
  }

  onSelect(e: DfTableSelectEvent): void {
    if (e.rows.length > 1 || (!e.row && e.rows.length)) {
      this.log(`Seleccionadas en ${e.tableId} (${e.rows.length}): ${e.rows.map((r) => r['numero'] ?? JSON.stringify(r)).join(', ')}`);
      return;
    }
    this.log(e.row ? `Seleccionada en ${e.tableId}: ${JSON.stringify(e.row)}` : `Selección vaciada en ${e.tableId}`);
  }

  private log(text: string): void {
    this.events.update((list) => [text, ...list].slice(0, 6));
  }
}
