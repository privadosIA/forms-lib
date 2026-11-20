import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { FieldArrayType, FormlyModule } from '@ngx-formly/core';
import { DfResolvedTotal, computeTotal, formatTotal } from '../../utils/array-totals';

interface TableColumn {
  label: string;
  col: number;
  required: boolean;
}

/** Lista repetible (nodo `array`): una fila por elemento, con botones para añadir y quitar. */
@Component({
  selector: 'df-repeat-field',
  standalone: true,
  imports: [FormlyModule],
  templateUrl: './repeat-field.component.html',
  styleUrl: './repeat-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepeatFieldComponent extends FieldArrayType implements AfterViewChecked {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Las celdas de una tabla no llevan etiqueta (la pone la cabecera). En un contenedor estrecho las celdas se
   * apilan y la etiqueta sale de `data-label` (ver _grid.scss); las filas de tabla no pueden ocultar campos,
   * así que la celda N de cada fila es la columna N.
   */
  ngAfterViewChecked(): void {
    if (!this.isTable) return;
    const cols = this.columns;
    this.host.nativeElement.querySelectorAll('.df-table-row').forEach((row) => {
      Array.from(row.children).forEach((cell, i) => {
        const c = cols[i];
        const label = c ? c.label + (c.required ? ' *' : '') : '';
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
      });
    });
  }

  get isTable(): boolean {
    return this.props['display'] === 'table';
  }

  get columns(): TableColumn[] {
    return (this.props['tableColumns'] as TableColumn[] | undefined) ?? [];
  }

  /** Plantilla de columnas de la rejilla de la tabla: el `col` de cada campo hace de peso relativo. */
  get tableTemplate(): string {
    return this.columns.map((c) => `minmax(0, ${c.col}fr)`).join(' ');
  }

  /** Ancho mínimo de la tabla (9rem por columna y el botón de quitar): por debajo de eso se desplaza en horizontal. */
  get tableMinWidth(): string {
    return `${this.columns.length * 9 + 2.25}rem`;
  }

  /** Totales calculados con las filas actuales: se recalculan en cada ciclo de detección. */
  get totals(): { label: string; text: string }[] {
    const defs = (this.props['totals'] as DfResolvedTotal[] | undefined) ?? [];
    const rows = this.formControl.value;
    return defs.map((t) => ({ label: t.label, text: formatTotal(computeTotal(rows, t), t) }));
  }

  get rowCount(): number {
    return this.field.fieldGroup?.length ?? 0;
  }

  get locked(): boolean {
    return this.props.disabled === true || this.props.readonly === true;
  }

  get canAdd(): boolean {
    const max = this.props['maxItems'] as number | undefined;
    return !this.locked && (max == null || this.rowCount < max);
  }

  get canRemove(): boolean {
    const min = (this.props['minItems'] as number | undefined) ?? 0;
    return !this.locked && this.rowCount > min;
  }

  rowTitle(index: number): string {
    return `${(this.props['itemLabel'] as string | undefined) || 'Elemento'} ${index + 1}`;
  }
}
