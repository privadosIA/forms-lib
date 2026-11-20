import {
  ChangeDetectionStrategy, Component, DestroyRef, HostBinding, computed, contentChildren, effect, inject, input, model, output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions, FormlyModule } from '@ngx-formly/core';
import { DfFormStatus, DfSubmitEvent, DfTableActionEvent, DfTableNavigateEvent, DfTableSelectEvent } from '../models/config.model';
import { DfFormSchema } from '../models/schema.model';
import { FormSchemaAdapterService } from '../services/form-schema-adapter.service';
import { DYNAMIC_FORMS_CONFIG } from '../tokens/dynamic-forms.tokens';
import { DF_SLOTS, DfSlotDirective } from '../directives/slot.directive';
import { DF_TABLE_SLOTS, DfCellDirective, DfEmptyDirective } from '../directives/table-slots';
import { DF_TABLE_CONTROLS, DfTableControls, DF_TABLE_EVENTS } from '../types/table-field/table-field.component';
import { DF_CONTEXT_KEY } from '../utils/model-path';
import { isCssLength } from '../utils/css-length';

type Model = Record<string, unknown>;

/**
 * Fachada pública. Encapsula el ciclo de vida de Formly:
 *
 *   <dynamic-form [schema]="schema" [(model)]="model" (formSubmit)="onSubmit($event)">
 *     <button dfActions type="submit">Guardar</button>
 *   </dynamic-form>
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- selector público del contrato (ComponentAPI)
  selector: 'dynamic-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormlyModule],
  templateUrl: './dynamic-form.component.html',
  styleUrl: './dynamic-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFormComponent {
  private readonly adapter = inject(FormSchemaAdapterService);
  private readonly config = inject(DYNAMIC_FORMS_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  // ----- Inputs -------------------------------------------------------------
  readonly schema = input.required<DfFormSchema>();
  readonly model = model<Model>({});
  readonly submitLabel = input<string>('Enviar');
  readonly showDefaultActions = input<boolean>(true);
  readonly validateOnInit = input<boolean>(false);
  /**
   * Cuándo se muestran los errores: `'touched'` (por defecto) al tocar el campo o enviar; `'always'` desde que el
   * campo existe, también los que aparecen después (secciones condicionales, filas nuevas).
   */
  /**
   * Datos externos al formulario para las condiciones: `{ "field": "ctx.modo", ... }` lee `context().modo`. Si el objeto
   * cambia, las condiciones se reevalúan.
   */
  readonly context = input<Record<string, unknown>>({});
  readonly showErrors = input<'touched' | 'always'>('touched');

  // ----- Outputs ------------------------------------------------------------
  readonly formSubmit = output<DfSubmitEvent>();
  readonly formInvalidSubmit = output<DfSubmitEvent>();
  readonly valueChange = output<Model>();
  readonly statusChange = output<DfFormStatus>();
  readonly formReady = output<FormGroup>();
  /** Un botón de fila de una tabla (`table.actions`) pulsado. */
  readonly tableAction = output<DfTableActionEvent>();
  /** Una fila de una tabla `selectable` seleccionada, o null al deseleccionarla. */
  readonly tableSelect = output<DfTableSelectEvent>();
  /** Un enlace de una columna `link` pulsado: `originalEvent.preventDefault()` y navega tú para no recargar la página. */
  readonly tableNavigate = output<DfTableNavigateEvent>();

  // Plantillas de la app para las tablas: `<ng-template dfCell="nombre">` y `<ng-template dfEmpty="id">`.
  private readonly cellTemplates = contentChildren(DfCellDirective);
  private readonly emptyTemplates = contentChildren(DfEmptyDirective);
  // Plantillas de la app para los nodos `slot` del esquema: `<ng-template dfSlot="nombre">`.
  private readonly slotTemplates = contentChildren(DfSlotDirective);

  // ----- Estado interno -----------------------------------------------------
  readonly form = new FormGroup({});
  readonly options: FormlyFormOptions = { formState: {} };
  readonly fields = computed<FormlyFieldConfig[]>(() => this.adapter.toFormly(this.schema()));
  readonly title = computed(() => this.schema().title);
  readonly description = computed(() => this.schema().description);
  readonly formId = computed(() => `df-${this.schema().id}`);

  @HostBinding('class') readonly hostClass = `df-form ${this.config.theme.hostClass ?? ''}`.trim();

  /** layout.gap del esquema → --df-grid-gap (solo longitudes CSS simples). */
  @HostBinding('style.--df-grid-gap') get gridGap(): string | null {
    const gap = this.schema().layout?.gap;
    return isCssLength(gap) ? gap.trim() : null;
  }

  private initialModel: Model = {};

  constructor() {
    this.options.formState[DF_TABLE_EVENTS] = {
      action: (e: DfTableActionEvent) => this.tableAction.emit(e),
      select: (e: DfTableSelectEvent) => this.tableSelect.emit(e),
      navigate: (e: DfTableNavigateEvent) => this.tableNavigate.emit(e),
    };
    this.options.formState[DF_TABLE_CONTROLS] = new Map<string, DfTableControls>();
    this.options.formState[DF_CONTEXT_KEY] = this.context();
    // Formly solo reevalúa las expresiones al cambiar el modelo: un contexto nuevo hay que avisarlo.
    effect(() => {
      const context = this.context();
      untracked(() => {
        this.options.formState[DF_CONTEXT_KEY] = context;
        const root = this.fields()[0];
        // Si el esquema cambió a la vez, Formly aún no ha construido la raíz nueva (sin `options`): ya leerá el contexto al construirla.
        if (root?.options && this.options.detectChanges) this.options.detectChanges(root);
      });
    });
    this.options.formState[DF_SLOTS] = { get: (name: string) => this.slotTemplates().find((s) => s.name() === name)?.template ?? null };
    this.options.formState[DF_TABLE_SLOTS] = {
      cell: (name: string) => this.cellTemplates().find((c) => c.name() === name)?.template ?? null,
      empty: (id: string) => (this.emptyTemplates().find((e) => e.table() === id) ?? this.emptyTemplates().find((e) => !e.table()))?.template ?? null,
    };
    this.form.statusChanges.pipe(takeUntilDestroyed()).subscribe((s) => {
      if (this.showErrors() === 'always') this.form.markAllAsTouched();
      this.statusChange.emit(s as DfFormStatus);
    });

    // Cada esquema nuevo → snapshot del modelo inicial para reset().
    effect(() => {
      this.schema();
      untracked(() => {
        this.initialModel = structuredClone(this.model());
        this.formReady.emit(this.form);
        if (this.validateOnInit() || this.showErrors() === 'always') queueMicrotask(() => this.markAllAsTouched());
      });
    });
  }

  get valid(): boolean {
    return this.form.valid;
  }

  onModelChange(next: Model): void {
    this.model.set({ ...next });
    this.valueChange.emit(this.model());
  }

  submit(): void {
    this.markAllAsTouched();
    const event: DfSubmitEvent = { model: this.model(), form: this.form, schema: this.schema() };
    if (this.form.valid) this.formSubmit.emit(event);
    else this.formInvalidSubmit.emit(event);
  }

  reset(next?: Model): void {
    const value = structuredClone(next ?? this.initialModel);
    this.options.resetModel?.(value);
    this.model.set(value);
  }

  /**
   * Marca las filas que marcaría la casilla de la cabecera de una tabla `selectable: 'multiple'` (en modo `server`,
   * las de la página). Sin `tableId` actúa sobre todas las tablas. Emite `tableSelect` con `changed`.
   */
  selectAll(tableId?: string): void {
    this.tableControls(tableId).forEach((t) => t.selectAll());
  }

  /** Vacía la selección de una tabla (también la de otras páginas). Sin `tableId` actúa sobre todas las tablas. */
  clearSelection(tableId?: string): void {
    this.tableControls(tableId).forEach((t) => t.clearSelection());
  }

  private tableControls(tableId?: string): DfTableControls[] {
    const all = this.options.formState[DF_TABLE_CONTROLS] as Map<string, DfTableControls>;
    if (tableId === undefined) return [...all.values()];
    const one = all.get(tableId);
    return one ? [one] : [];
  }

  markAllAsTouched(): void {
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
  }

  /**
   * Vuelve a ejecutar los validadores de todos los controles. Para validadores que leen estado fuera del
   * formulario (una señal, un servicio): llámalo cuando ese estado cambie.
   */
  revalidate(): void {
    const walk = (control: AbstractControl): void => {
      if (control instanceof FormGroup || control instanceof FormArray) {
        Object.values(control.controls).forEach(walk);
      }
      control.updateValueAndValidity({ onlySelf: true });
    };
    walk(this.form);
    this.form.updateValueAndValidity();
  }
}
