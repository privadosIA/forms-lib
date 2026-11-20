import { Component, DestroyRef, computed, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DfArray, DfField, DfFormSchema, DfFormStatus, DfGroup, DfNode, DfTable, DfSchemaIssue, DynamicFormComponent, FormSchemaAdapterService,
  SchemaValidatorService, isDfArray, isDfGroup, isDfSlot, isDfTable,
} from '@core/dynamic-forms';
import { Subject, debounceTime } from 'rxjs';
import { ModelViewerComponent } from '../../shared/model-viewer/model-viewer.component';
import { SchemaLoaderService } from '../../shared/schema-loader/schema-loader.service';
import { EDITOR_PRESETS } from './presets';
import {
  ARRAY_PROPERTIES, FIELD_PROPERTIES, FORM_PROPERTIES, GROUP_PROPERTIES, applyArrayModel, applyFieldModel, applyFormModel,
  applyGroupModel, applyTableModel, TABLE_PROPERTIES, toArrayModel, toTableModel, toFieldModel, toFormModel, toGroupModel,
} from './property-forms';
import { NodePath, flatten, freeName, getNode, insertNode, moveNode, nodeName, removeNode, replaceNode, samePath } from './schema-tree';

type Model = Record<string, unknown>;
type Tab = 'campos' | 'json' | 'modelo';
/** De dónde viene un cambio del esquema: el JSON no se reescribe si lo está editando el usuario. */
type Origin = 'visual' | 'json';

const STORAGE_KEY = 'df-demo-editor';

const TYPE_BADGES: Record<string, string> = {
  text: 'texto', email: 'email', password: 'clave', number: 'número', textarea: 'área', select: 'lista',
  multiselect: 'lista+', radio: 'radio', checkbox: 'casilla', date: 'fecha', hidden: 'oculto', currency: 'importe', group: 'grupo', array: 'lista', table: 'tabla', slot: 'slot',
};

/**
 * Escenario 3: editor en vivo. A la izquierda se pinta el esquema; a la derecha se edita con un
 * árbol de campos y un panel de propiedades (otro <dynamic-form>), o directamente en JSON. Si el
 * esquema deja de ser válido se listan las incidencias y la vista previa conserva la última versión válida.
 */
@Component({
  selector: 'app-schema-editor',
  standalone: true,
  imports: [DynamicFormComponent, ModelViewerComponent],
  templateUrl: './schema-editor.component.html',
  styleUrl: './schema-editor.component.scss',
})
export class SchemaEditorComponent {
  private readonly loader = inject(SchemaLoaderService);
  private readonly validator = inject(SchemaValidatorService);
  private readonly adapter = inject(FormSchemaAdapterService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly jsonInput = new Subject<string>();

  readonly presets = EDITOR_PRESETS;
  readonly presetId = signal('catalogo');
  readonly tab = signal<Tab>('campos');

  readonly draft = signal<DfFormSchema>(EDITOR_PRESETS[0].schema!);
  readonly rendered = signal<DfFormSchema | null>(null);
  readonly jsonText = signal('');
  readonly jsonError = signal<string | null>(null);
  readonly issues = signal<DfSchemaIssue[]>([]);
  readonly valid = computed(() => !this.jsonError() && this.issues().length === 0);

  readonly model = signal<Model>({});
  readonly status = signal<DfFormStatus | ''>('');
  readonly lastSubmit = signal<unknown>(null);

  /** Nodo seleccionado en el árbol; null es el propio formulario. */
  readonly selected = signal<NodePath | null>(null);
  readonly rows = computed(() => flatten(this.draft()));
  private readonly panelVersion = signal(0);

  /**
   * Panel de propiedades del nodo seleccionado. Se recrea al cambiar de selección o cuando el
   * esquema cambia por fuera del panel (JSON, tipo de campo); mientras se escribe en él, no.
   */
  readonly panel = computed(() => {
    const version = this.panelVersion();
    const path = this.selected();
    return untracked(() => {
      const node = path ? getNode(this.draft(), path) : undefined;
      const key = `${path?.join('.') ?? 'form'}#${version}`;
      // Un slot no tiene propiedades que editar en el panel (name y logic se cambian en el JSON): se muestra el del formulario.
      if (!node || isDfSlot(node)) return { key, kind: 'form' as const, schema: FORM_PROPERTIES, model: toFormModel(this.draft()) };
      if (isDfTable(node)) return { key, kind: 'table' as const, schema: TABLE_PROPERTIES, model: toTableModel(node) };
      if (isDfArray(node)) return { key, kind: 'array' as const, schema: ARRAY_PROPERTIES, model: toArrayModel(node) };
      if (isDfGroup(node)) return { key, kind: 'group' as const, schema: GROUP_PROPERTIES, model: toGroupModel(node) };
      return { key, kind: 'field' as const, schema: FIELD_PROPERTIES, model: toFieldModel(node) };
    });
  });

  constructor() {
    const saved = this.readStorage();
    if (saved) {
      this.presetId.set(saved.presetId);
      this.commit(saved.schema, 'visual');
    } else {
      this.commit(structuredClone(EDITOR_PRESETS[0].schema!), 'visual');
    }
    this.jsonInput.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe((text) => this.applyJson(text));
  }

  // --- Ejemplos -------------------------------------------------------------------

  loadPreset(id: string): void {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    this.presetId.set(id);
    const start = (schema: DfFormSchema) => {
      this.selected.set(null);
      this.resetModel();
      this.commit(structuredClone(schema), 'visual');
      this.panelVersion.update((v) => v + 1);
    };
    if (preset.schema) start(preset.schema);
    else this.loader.load(preset.file!).subscribe(start);
  }

  resetModel(): void {
    this.model.set({});
    this.lastSubmit.set(null);
  }

  // --- Árbol ------------------------------------------------------------------------

  select(path: NodePath | null): void {
    this.selected.set(path);
  }

  isSelected(path: NodePath | null): boolean {
    return path === null ? this.selected() === null : samePath(this.selected(), path);
  }

  addField(): void {
    const field: DfField = { key: freeName(this.draft(), 'campo'), type: 'text', label: 'Nuevo campo' };
    this.insert(field);
  }

  addGroup(): void {
    const id = freeName(this.draft(), 'grupo');
    const group: DfGroup = {
      type: 'group', id, title: 'Nuevo grupo', columns: 2,
      fields: [{ key: freeName(this.draft(), 'campo'), type: 'text', label: 'Nuevo campo' }],
    };
    this.insert(group);
  }

  addTable(): void {
    const table: DfTable = {
      type: 'table', id: freeName(this.draft(), 'tabla'), title: 'Nueva tabla', filter: true, pageSize: 5,
      columns: [{ key: 'nombre', label: 'Nombre' }, { key: 'alta', label: 'Alta', type: 'date' }],
      rows: [{ nombre: 'Ana', alta: '2024-03-15' }, { nombre: 'Luis', alta: '2023-11-02' }],
    };
    this.insert(table);
  }

  addArray(): void {
    const array: DfArray = {
      type: 'array', key: freeName(this.draft(), 'lista'), title: 'Nueva lista', itemLabel: 'Elemento',
      fields: [{ key: freeName(this.draft(), 'campo'), type: 'text', label: 'Nuevo campo' }],
    };
    this.insert(array);
  }

  move(path: NodePath, delta: -1 | 1): void {
    const moved = moveNode(this.draft(), path, delta);
    if (!moved) return;
    this.commit(moved.schema, 'visual');
    if (samePath(this.selected(), path)) this.selected.set(moved.path);
  }

  remove(path: NodePath): void {
    this.commit(removeNode(this.draft(), path), 'visual');
    this.selected.set(null);
  }

  private insert(node: DfNode): void {
    const inserted = insertNode(this.draft(), this.selected(), node);
    this.commit(inserted.schema, 'visual');
    this.selected.set(inserted.path);
  }

  /** Texto de una fila del árbol. */
  describe(node: DfNode): { badge: string; title: string; name: string } {
    if (isDfGroup(node)) return { badge: TYPE_BADGES['group'], title: node.title || '(sin título)', name: node.id };
    if (isDfTable(node)) return { badge: TYPE_BADGES['table'], title: node.title || '(sin título)', name: nodeName(node) };
    if (isDfArray(node)) return { badge: TYPE_BADGES['array'], title: node.title || '(sin título)', name: nodeName(node) };
    if (isDfSlot(node)) return { badge: TYPE_BADGES['slot'], title: '(hueco de la app)', name: node.name };
    return { badge: TYPE_BADGES[node.type] ?? node.type, title: node.label || '(sin etiqueta)', name: node.key };
  }

  pathKey(path: NodePath): string {
    return path.join('.');
  }

  // --- Panel de propiedades --------------------------------------------------------

  onPanelChange(model: Model): void {
    const panel = this.panel();
    const path = this.selected();
    if (panel.kind === 'form' || !path) {
      this.commit(applyFormModel(this.draft(), model), 'visual');
      return;
    }
    const node = getNode(this.draft(), path);
    if (!node) return;
    if (panel.kind === 'table') {
      this.commit(replaceNode(this.draft(), path, applyTableModel(node as DfTable, model)), 'visual');
      return;
    }
    if (panel.kind === 'array') {
      this.commit(replaceNode(this.draft(), path, applyArrayModel(node as DfArray, model)), 'visual');
      // Al pasar de filas a tabla (o al revés) cambian los campos visibles del panel.
      if ((node as DfArray).display !== (model['display'] === 'table' ? 'table' : undefined)) this.panelVersion.update((v) => v + 1);
      return;
    }
    if (panel.kind === 'group') {
      this.commit(replaceNode(this.draft(), path, applyGroupModel(node as DfGroup, model)), 'visual');
      return;
    }
    const before = node as DfField;
    const after = applyFieldModel(before, model);
    this.commit(replaceNode(this.draft(), path, after), 'visual');
    // Al cambiar el tipo cambian las secciones del panel y pueden aparecer opciones por defecto.
    if (after.type !== before.type) this.panelVersion.update((v) => v + 1);
  }

  // --- JSON ---------------------------------------------------------------------------

  onJsonInput(text: string): void {
    this.jsonText.set(text);
    this.jsonInput.next(text);
  }

  /** Tab inserta dos espacios en vez de saltar al siguiente control. */
  insertTab(event: Event): void {
    event.preventDefault();
    const area = event.target as HTMLTextAreaElement;
    area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end');
    this.onJsonInput(area.value);
  }

  formatJson(): void {
    if (!this.jsonError()) this.jsonText.set(this.pretty(this.draft()));
  }

  copyJson(): void {
    navigator.clipboard?.writeText(this.jsonText()).catch(() => undefined);
  }

  private applyJson(text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      this.jsonError.set(`JSON no válido: ${(e as Error).message}`);
      return;
    }
    this.jsonError.set(null);
    this.commit(parsed as DfFormSchema, 'json');
    // El árbol y el panel se rehacen con lo que diga el JSON.
    const path = this.selected();
    if (path && !getNode(this.draft(), path)) this.selected.set(null);
    this.panelVersion.update((v) => v + 1);
  }

  // --- Estado común -------------------------------------------------------------------

  /** Aplica un esquema nuevo: valida, actualiza la vista previa si es válido y lo guarda. */
  private commit(schema: DfFormSchema, origin: Origin): void {
    this.draft.set(schema);
    if (origin === 'visual') {
      this.jsonText.set(this.pretty(schema));
      this.jsonError.set(null);
    }
    const issues = [...this.validator.validate(schema).errors];
    if (issues.length === 0) {
      try {
        this.adapter.toFormly(schema);
      } catch (e) {
        issues.push({ path: '$', message: (e as Error).message });
      }
    }
    this.issues.set(issues);
    if (issues.length === 0) this.rendered.set(schema);
    this.writeStorage();
  }

  private pretty(schema: DfFormSchema): string {
    return JSON.stringify(schema, null, 2);
  }

  private readStorage(): { schema: DfFormSchema; presetId: string } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private writeStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: this.draft(), presetId: this.presetId() }));
    } catch {
      // Sin almacenamiento (modo privado, cuota…): el editor funciona igual, solo no recuerda el borrador.
    }
  }
}
