import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DfSlotDirective } from '../directives/slot.directive';
import { DfCellDirective, DfEmptyDirective } from '../directives/table-slots';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { DfFormStatus, DfSubmitEvent, DynamicFormsConfig } from '../models/config.model';
import { DfFormSchema, DfNode } from '../models/schema.model';
import { provideDynamicForms } from '../providers/provide-dynamic-forms';

type Model = Record<string, unknown>;

/**
 * Host de pruebas: renderiza <dynamic-form> con el PLAIN_THEME real y registra
 * todo lo que emite. Solo para specs (excluido del build de la librería).
 */
@Component({
  standalone: true,
  // Muta propiedades a mano: en Angular 22 el valor por defecto es OnPush, así que se fija Default (Eager) a propósito.
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [DynamicFormComponent, DfCellDirective, DfEmptyDirective, DfSlotDirective],
  template: `
    <dynamic-form
      [schema]="schema"
      [(model)]="model"
      [submitLabel]="submitLabel"
      [showDefaultActions]="showDefaultActions"
      [validateOnInit]="validateOnInit"
      [showErrors]="showErrors"
      [context]="context"
      (formSubmit)="submitted.push($event)"
      (formInvalidSubmit)="invalidSubmitted.push($event)"
      (valueChange)="changes.push($event)"
      (statusChange)="statuses.push($event)">
      <p dfHeader class="test-header">Cabecera</p>
      <button dfActions type="button" class="test-action">Cancelar</button>
      <ng-template dfCell="estado" let-row let-value="value"><b class="slot-estado" [attr.data-nombre]="row.nombre">{{ value }}!</b></ng-template>
      <ng-template dfSlot="resumen" let-model let-name="name"><p class="slot-resumen" [attr.data-name]="name">Hola {{ model.nombre }}</p></ng-template>
      <ng-template dfEmpty="sinfilas" let-table><p class="slot-empty">Sin filas en {{ table }}</p></ng-template>
    </dynamic-form>
  `,
})
export class DfTestHostComponent {
  @ViewChild(DynamicFormComponent) dynamicForm!: DynamicFormComponent;
  schema!: DfFormSchema;
  model: Model = {};
  submitLabel = 'Enviar';
  showDefaultActions = true;
  validateOnInit = false;
  showErrors: 'touched' | 'always' = 'touched';
  context: Record<string, unknown> = {};
  submitted: DfSubmitEvent[] = [];
  invalidSubmitted: DfSubmitEvent[] = [];
  changes: Model[] = [];
  statuses: DfFormStatus[] = [];
}

export interface RenderOptions {
  model?: Model;
  config?: DynamicFormsConfig;
  host?: Partial<Pick<DfTestHostComponent, 'submitLabel' | 'showDefaultActions' | 'validateOnInit' | 'showErrors' | 'context'>>;
  title?: string;
  description?: string;
}

export interface RenderedForm {
  fixture: ComponentFixture<DfTestHostComponent>;
  host: DfTestHostComponent;
  el: HTMLElement;
  $<T extends Element = HTMLElement>(selector: string): T | null;
  $$<T extends Element = HTMLElement>(selector: string): T[];
  /** Detecta cambios y espera a que se asienten (async validators, observables…). */
  stable(): Promise<void>;
  /** Cambia el esquema del host (sin zone.js hay que marcar el host para revisión). */
  setSchema(schema: DfFormSchema): Promise<void>;
  /**
   * Escribe en un input/textarea como lo haría el usuario. Con `settle: false` solo detecta cambios y no espera
   * (en Angular 22 `whenStable` espera a los temporizadores, así que un debounce se dispararía antes de tiempo).
   */
  type(selector: string, value: string, settle?: boolean): Promise<void>;
  /** Elige una opción de un <select> por su texto visible. */
  choose(selector: string, label: string, settle?: boolean): Promise<void>;
  click(selector: string): Promise<void>;
  submit(): Promise<void>;
}

export const formSchema = (fields: DfNode[], extra: Partial<DfFormSchema> = {}): DfFormSchema =>
  ({ version: '1.0', id: 'prueba', fields, ...extra });

export async function renderForm(fields: DfNode[] | DfFormSchema, opts: RenderOptions = {}): Promise<RenderedForm> {
  TestBed.configureTestingModule({
    imports: [DfTestHostComponent],
    providers: [provideDynamicForms(opts.config)],
  });
  const fixture = TestBed.createComponent(DfTestHostComponent);
  const host = fixture.componentInstance;
  host.schema = Array.isArray(fields)
    ? formSchema(fields, { title: opts.title, description: opts.description })
    : fields;
  host.model = opts.model ?? {};
  Object.assign(host, opts.host ?? {});

  const el = fixture.nativeElement as HTMLElement;
  const $ = <T extends Element = HTMLElement>(s: string) => el.querySelector<T>(s) as T | null;
  const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(el.querySelectorAll(s)) as T[];
  const must = <T extends Element>(s: string): T => {
    const found = $<T>(s);
    if (!found) throw new Error(`No existe "${s}" en el formulario renderizado`);
    return found;
  };
  const stable = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  await stable();

  return {
    fixture, host, el, $, $$, stable,
    async setSchema(schema) {
      host.schema = schema;
      fixture.changeDetectorRef.markForCheck();
      await stable();
    },
    async type(selector, value, settle = true) {
      const input = must<HTMLInputElement | HTMLTextAreaElement>(selector);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      if (settle) await stable();
      else fixture.detectChanges();
    },
    async choose(selector, label, settle = true) {
      const select = must<HTMLSelectElement>(selector);
      const option = Array.from(select.options).find((o) => o.textContent?.trim() === label);
      if (!option) throw new Error(`"${selector}" no tiene la opción "${label}"`);
      select.value = option.value;
      select.dispatchEvent(new Event('change'));
      if (settle) await stable();
      else fixture.detectChanges();
    },
    async click(selector) {
      must<HTMLElement>(selector).click();
      await stable();
    },
    async submit() {
      must<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
      await stable();
    },
  };
}
