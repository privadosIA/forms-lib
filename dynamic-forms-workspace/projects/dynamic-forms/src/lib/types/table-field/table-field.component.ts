import { DOCUMENT } from '@angular/common';
import { AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef, Component, DoCheck, ElementRef, HostListener, OnDestroy, OnInit, TemplateRef, inject } from '@angular/core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { EMPTY, Subject, catchError, debounceTime, map, of, switchMap, take, takeUntil } from 'rxjs';
import { DfRule, DfTableAction, DfTableSource } from '../../models/schema.model';
import { DfTableActionEvent, DfTableNavigateEvent, DfTablePage, DfTableRequest, DfTableSelectEvent } from '../../models/config.model';
import { NgTemplateOutlet } from '@angular/common';
import { DF_TABLE_SLOTS, DfCellContext, DfTableSlots } from '../../directives/table-slots';
import { ConditionEvaluatorService, getByPath } from '../../services/condition-evaluator.service';
import { DF_TABLE_PROVIDER, DYNAMIC_FORMS_CONFIG } from '../../tokens/dynamic-forms.tokens';
import { contextOf, paramName, readPath, rootModel } from '../../utils/model-path';
import { csvFileName, toCsv } from '../../utils/csv';
import { tableIconPath } from '../../utils/table-icons';
import { DEFAULT_TABLE_TEXTS, DfTableTexts, fillText } from '../../utils/table-texts';
import { DfTableState, MAX_WIDTH, MIN_WIDTH, WIDTH_ACTIONS, WIDTH_CHECK, parseTableState } from '../../utils/table-state';
import { DfResolvedColumn, cellText, columnFilterKind, columnFilterOptions, filterByColumns, filterRows, resolveHref, sortRowsBy } from '../../utils/table';

type Row = Record<string, unknown>;

/** Clave de formState donde `<dynamic-form>` deja la función que recibe los eventos de las tablas. */
export const DF_TABLE_EVENTS = 'dfTableEvents';

/** Clave de formState con el registro de tablas vivas (`tableId` → controles), que `<dynamic-form>` usa para `selectAll()` y `clearSelection()`. */
export const DF_TABLE_CONTROLS = 'dfTableControls';

export interface DfTableControls {
  selectAll(): void;
  clearSelection(): void;
}

export interface DfTableEvents {
  action(event: DfTableActionEvent): void;
  select(event: DfTableSelectEvent): void;
  navigate(event: DfTableNavigateEvent): void;
}

const DEFAULT_PAGE_SIZES = [5, 10, 25, 100];
/** Espera tras la última tecla antes de pedir al servidor las filas filtradas. */
const FILTER_DEBOUNCE_MS = 300;

type LoadState = 'idle' | 'loading' | 'error';
type Job = { endpoint: string; request: DfTableRequest } | null;

/** Tabla de datos de solo lectura (nodo `table`): filtro, orden, paginación, acciones por fila y selección. */
@Component({
  selector: 'df-table-field',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './table-field.component.html',
  styleUrl: './table-field.component.scss',
  // Los datos pueden cambiar desde fuera (el modelo), sin que Formly avise a este componente.
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TableFieldComponent extends FieldType<FormlyFieldConfig> implements OnInit, DoCheck, AfterViewChecked, OnDestroy {
  private readonly provider = inject(DF_TABLE_PROVIDER, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly evaluator = inject(ConditionEvaluatorService);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly config = inject(DYNAMIC_FORMS_CONFIG, { optional: true });
  /** Últimos desplazamientos de las columnas fijas que se escribieron en el DOM. */
  private frozenOffsets = '';
  private readonly destroyed$ = new Subject<void>();
  /** Peticiones al servicio; null cancela la que esté en vuelo. switchMap descarta las respuestas viejas. */
  private readonly jobs$ = new Subject<Job>();
  /** Avisa de que el usuario tocó el buscador o un filtro de columna (modo server: se espera a que pare). */
  private readonly filterInput$ = new Subject<void>();

  // Estado de la carga remota (source).
  loadState: LoadState = 'idle';
  /** Filas que dio el servicio: todas (modo client) o solo la página actual (modo server). */
  private remoteRows: Row[] = [];
  /** Total de filas que cumplen el filtro en el servidor (modo server). */
  private remoteTotal = 0;
  /** Faltan campos de `dependsOn` por rellenar: no se pide nada. */
  waiting = false;
  private paramsKey: string | null = null;
  /** Filtro que ya se ha enviado al servidor (modo server). */
  private appliedFilter = '';
  /** Filtros por columna que ya se han enviado al servidor (modo server). */
  private appliedColumnFilters: Record<string, string> = {};

  filterText = '';
  /** Lo que el usuario ha escrito o elegido en los filtros de columna (`key` → valor). */
  columnFilters: Partial<Record<string, string>> = {};
  /** Exportando: en modo server se piden al servicio todas las filas. */
  exporting = false;
  exportFailed = false;
  /** Orden actual: de la columna principal a la última que desempata (más de una solo con `multiSort`). */
  sorts: { key: string; direction: 'asc' | 'desc' }[] = [];
  pageIndex = 0;
  /** Null hasta que el usuario cambia el tamaño; mientras, el del esquema. */
  private pageSizeChoice: number | null = null;
  private sortInitialised = false;
  /** Fila elegida con `selectable` simple. */
  selected: Row | null = null;
  /** Filas marcadas con `selectable: 'multiple'`, por `selectionKey` o, sin ella, por objeto. */
  private readonly selection = new Map<unknown, Row>();

  // Resultado de filtrar y ordenar, recalculado solo si cambia algo de lo que depende.
  private cache: { rows: Row[]; length: number; filter: string; columnFilters: string; sorts: string; result: Row[] } | null = null;

  /** Textos de la app (`provideDynamicForms({ tableTexts })`); lo que no define queda en español. */
  get texts(): DfTableTexts {
    return this.config?.tableTexts ?? DEFAULT_TABLE_TEXTS;
  }

  get noResultsText(): string {
    const text = this.filterText.trim();
    return text ? fillText(this.texts.noResults, { text: this.filterText }) : this.texts.noResultsFiltered;
  }

  filterAria(col: DfResolvedColumn): string {
    return fillText(this.texts.filterBy, { label: col.label });
  }

  /** Columnas del esquema, en su orden y con su `frozen`. */
  private get schemaColumns(): DfResolvedColumn[] {
    return this.props['columns'] as DfResolvedColumn[];
  }

  /**
   * Columnas que se pintan: las del esquema en el orden que el usuario eligió arrastrando (`orderKeys`) y, con
   * `pinnableColumns`, las que fijó (`pinnedKeys`) primero y en el orden en que las fijó. Las fijas van siempre
   * delante. Se cachea para que cada columna sea siempre el mismo objeto.
   */
  get columns(): DfResolvedColumn[] {
    const base = this.schemaColumns;
    const pinnedKeys = this.pinnable ? this.pinnedKeys : null;
    if (!pinnedKeys && !this.orderKeys) return base;
    const cached = this.columnsCache;
    if (cached && cached.base === base && cached.pinned === pinnedKeys && cached.order === this.orderKeys) return cached.result;
    const byKey = new Map(base.map((c) => [c.key, c]));
    const order = this.orderKeys;
    const ordered = order ? [...order.map((k) => byKey.get(k)), ...base.filter((c) => !order.includes(c.key))].filter((c): c is DfResolvedColumn => !!c) : base;
    let result: DfResolvedColumn[];
    if (pinnedKeys) {
      const pinned = pinnedKeys.map((k) => byKey.get(k)).filter((c): c is DfResolvedColumn => !!c).map((c) => (c.frozen ? c : { ...c, frozen: true }));
      const rest = ordered.filter((c) => !pinnedKeys.includes(c.key)).map((c) => (c.frozen ? { ...c, frozen: false } : c));
      result = [...pinned, ...rest];
    } else {
      // Sin fijado del usuario las fijas son las del esquema, y van delante aunque el orden guardado las separe.
      result = [...ordered.filter((c) => c.frozen), ...ordered.filter((c) => !c.frozen)];
    }
    this.columnsCache = { base, pinned: pinnedKeys, order: this.orderKeys, result };
    return result;
  }

  get pinnable(): boolean {
    return this.props['pinnableColumns'] === true;
  }

  get reorderable(): boolean {
    return this.props['reorderableColumns'] === true;
  }

  /** Claves de las columnas fijas que el usuario dejó (null mientras no toque nada: manda el esquema). */
  private pinnedKeys: string[] | null = null;
  /** Orden de todas las columnas que el usuario eligió arrastrando (null: el del esquema). */
  private orderKeys: string[] | null = null;
  private columnsCache: { base: DfResolvedColumn[]; pinned: string[] | null; order: string[] | null; result: DfResolvedColumn[] } | null = null;
  /** Columna que se está arrastrando, y la que tiene el cursor encima. */
  dragKey: string | null = null;
  dropKey: string | null = null;
  /** Tras mover una columna con el teclado el foco vuelve a su cabecera cuando ya está en su sitio. */
  private refocusKey: string | null = null;

  private column(key: string | null): DfResolvedColumn | undefined {
    return key ? this.columns.find((c) => c.key === key) : undefined;
  }

  /** Solo se mueve entre columnas del mismo grupo: fijas con fijas, normales con normales. */
  canDrop(target: DfResolvedColumn): boolean {
    const from = this.column(this.dragKey);
    return this.reorderable && !!from && from.key !== target.key && from.frozen === target.frozen;
  }

  onDragStart(event: DragEvent, col: DfResolvedColumn): void {
    if (!this.reorderable) return;
    // Estirar un borde no debe arrastrar la columna.
    if (this.resize) return event.preventDefault();
    this.dragKey = col.key;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // Firefox no arrastra nada si no hay datos.
      event.dataTransfer.setData('text/plain', col.key);
    }
  }

  onDragOver(event: DragEvent, col: DfResolvedColumn): void {
    if (!this.canDrop(col)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropKey = col.key;
  }

  onDrop(event: DragEvent, col: DfResolvedColumn): void {
    event.preventDefault();
    const from = this.dragKey;
    if (from && this.canDrop(col)) this.moveColumn(from, col.key);
    this.onDragEnd();
  }

  onDragEnd(): void {
    this.dragKey = null;
    this.dropKey = null;
  }

  // --- Redimensionar columnas (resizableColumns) --------------------------------------

  get resizable(): boolean {
    return this.props['resizableColumns'] === true;
  }

  /** Anchos en px de cada columna una vez que el usuario cambia alguno (null: los del esquema, en %). */
  widths: Record<string, number> | null = null;
  private resize: { key: string; startX: number; startWidth: number } | null = null;

  /** Ancho de una pista de `<colgroup>`: px si el usuario ya redimensionó, % del esquema si no. */
  colWidth(col: DfResolvedColumn): string {
    return this.widths ? `${this.widths[col.key]}px` : `${this.width(col)}%`;
  }

  /** Ancho de la tabla entera: la suma de las pistas, para que sea más ancha que el contenedor y se desplace. */
  get tableWidth(): string | null {
    const w = this.widths;
    return w ? `${Object.values(w).reduce((sum, n) => sum + n, 0)}px` : null;
  }

  specialWidth(key: string): string | null {
    const n = this.widths?.[key];
    return n ? `${n}px` : null;
  }

  resizeLabel(col: DfResolvedColumn): string {
    return fillText(this.texts.resizeColumn, { label: col.label });
  }

  /** Toma los anchos que tienen ahora las celdas de la cabecera: de ahí parte cualquier cambio. */
  private measureWidths(): Record<string, number> {
    const heads = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('thead tr:first-child > th'));
    const out: Record<string, number> = {};
    let i = 0;
    if (this.multiple) out[WIDTH_CHECK] = heads[i++]?.offsetWidth || 36;
    for (const col of this.columns) out[col.key] = heads[i++]?.offsetWidth || 100;
    if (this.actions.length) out[WIDTH_ACTIONS] = heads[i]?.offsetWidth || 120;
    return out;
  }

  onResizeStart(event: PointerEvent, col: DfResolvedColumn): void {
    event.preventDefault();
    event.stopPropagation();
    const widths = this.widths ?? this.measureWidths();
    this.widths = widths;
    this.resize = { key: col.key, startX: event.clientX, startWidth: widths[col.key] };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  onResizeMove(event: PointerEvent): void {
    const r = this.resize;
    if (!r || !this.widths) return;
    this.setWidth(r.key, r.startWidth + event.clientX - r.startX);
  }

  onResizeEnd(): void {
    if (!this.resize) return;
    this.resize = null;
    this.saveState();
  }

  /** Con el borde enfocado, las flechas lo mueven 10 px (50 con Mayús). */
  onResizeKey(event: KeyboardEvent, col: DfResolvedColumn): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    const widths = this.widths ?? this.measureWidths();
    this.widths = widths;
    this.setWidth(col.key, widths[col.key] + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 50 : 10));
    this.saveState();
  }

  /** Doble clic en un borde: vuelven los anchos del esquema. */
  resetWidths(event: Event): void {
    event.stopPropagation();
    this.widths = null;
    this.saveState();
  }

  private setWidth(key: string, width: number): void {
    if (!this.widths) return;
    this.widths = { ...this.widths, [key]: Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))) };
  }

  /** Alt + flecha izquierda o derecha en una cabecera mueve la columna un sitio, dentro de su grupo. */
  onHeaderKey(event: KeyboardEvent, col: DfResolvedColumn): void {
    if (!this.reorderable || !event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const group = this.columns.filter((c) => c.frozen === col.frozen);
    const target = group[group.findIndex((c) => c.key === col.key) + (event.key === 'ArrowLeft' ? -1 : 1)];
    if (!target) return;
    this.moveColumn(col.key, target.key);
    this.refocusKey = col.key;
  }

  /** Pone `fromKey` en el sitio de `toKey`: una fija reordena las fijadas; una normal, el orden general. */
  private moveColumn(fromKey: string, toKey: string): void {
    const from = this.column(fromKey);
    if (!from) return;
    const move = (list: string[]) => {
      const out = list.filter((k) => k !== fromKey);
      out.splice(list.indexOf(toKey), 0, fromKey);
      return out;
    };
    if (this.pinnable && from.frozen) {
      const current = this.pinnedKeys ?? this.schemaColumns.filter((c) => c.frozen).map((c) => c.key);
      this.pinnedKeys = move(current);
    } else {
      this.orderKeys = move(this.orderKeys ?? this.schemaColumns.map((c) => c.key));
    }
    this.saveState();
  }

  /** Fija o suelta una columna: la fijada pasa al final de las fijas; la soltada vuelve a su sitio. */
  togglePin(col: DfResolvedColumn): void {
    const current = this.pinnedKeys ?? this.schemaColumns.filter((c) => c.frozen).map((c) => c.key);
    this.pinnedKeys = col.frozen ? current.filter((k) => k !== col.key) : [...current.filter((k) => k !== col.key), col.key];
    this.saveState();
  }

  pinLabel(col: DfResolvedColumn): string {
    return fillText(col.frozen ? this.texts.unpinColumn : this.texts.pinColumn, { label: col.label });
  }

  get actions(): DfTableAction[] {
    return (this.props['actions'] as DfTableAction[] | undefined) ?? [];
  }

  get hasFilter(): boolean {
    return this.props['filter'] === true;
  }

  get selectMode(): 'none' | 'single' | 'multiple' {
    const v = this.props['selectable'];
    return v === 'multiple' ? 'multiple' : v === true || v === 'single' ? 'single' : 'none';
  }

  get selectable(): boolean {
    return this.selectMode !== 'none';
  }

  get multiple(): boolean {
    return this.selectMode === 'multiple';
  }

  /** Hay columnas fijas a la izquierda. */
  get hasFrozen(): boolean {
    return this.columns.some((c) => c.frozen);
  }

  /** `left` de una columna fija: variable CSS que `ngAfterViewChecked` rellena con lo que miden las anteriores. */
  frozenLeft(col: DfResolvedColumn): string | null {
    return col.frozen ? `var(--df-frozen-${this.columns.indexOf(col)})` : null;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.frozenOffsets = '';
    this.ngAfterViewChecked();
  }

  /** Mide dónde empieza cada columna fija (la casilla de selección incluida) y lo deja en variables CSS. */
  ngAfterViewChecked(): void {
    if (this.refocusKey) {
      const key = this.refocusKey;
      this.refocusKey = null;
      const heads = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('thead tr:first-child > th[data-key]'));
      heads.find((h) => h.dataset['key'] === key)?.querySelector<HTMLElement>('button')?.focus();
    }
    if (!this.hasFrozen) return;
    const table = this.host.nativeElement.querySelector<HTMLElement>('.df-table__table');
    const heads = table?.querySelectorAll<HTMLElement>('thead tr:first-child > th');
    if (!table || !heads) return;
    // `offsetLeft` no sirve: en una celda sticky incluye el `left` que ya se le puso y se realimenta.
    // Se suman los anchos de las celdas anteriores, que no dependen de la posición.
    const offset = this.multiple ? 1 : 0;
    const starts: number[] = [];
    let x = 0;
    heads.forEach((h) => {
      starts.push(x);
      x += h.offsetWidth;
    });
    const lefts: string[] = [];
    if (this.multiple) lefts.push(`--df-frozen-check:${starts[0] ?? 0}px`);
    this.columns.forEach((col, i) => {
      if (col.frozen) lefts.push(`--df-frozen-${i}:${starts[i + offset] ?? 0}px`);
    });
    const key = lefts.join(';');
    if (key === this.frozenOffsets) return;
    this.frozenOffsets = key;
    for (const l of lefts) {
      const [name, value] = l.split(':');
      table.style.setProperty(name, value);
    }
  }

  // --- Estado entre visitas (persistState) -------------------------------------------

  /** Dónde se guarda el estado, o null si la tabla no lo recuerda o el navegador no deja usar el almacén. */
  private get storage(): Storage | null {
    const mode = this.props['persistState'];
    if (!mode) return null;
    try {
      const win = this.document.defaultView;
      return (mode === 'local' ? win?.localStorage : win?.sessionStorage) ?? null;
    } catch {
      return null;
    }
  }

  private get stateKey(): string {
    return `df-table:${this.props['stateKey'] as string}`;
  }

  private restoreState(): void {
    const storage = this.storage;
    if (!storage) return;
    let raw: string | null = null;
    try {
      raw = storage.getItem(this.stateKey);
    } catch {
      return;
    }
    const state = parseTableState(raw, {
      columnKeys: this.schemaColumns.map((c) => c.key),
      filterKeys: this.schemaColumns.filter((c) => c.filter).map((c) => c.key),
      pinnable: this.pinnable,
      reorderable: this.reorderable,
      resizable: this.resizable,
    });
    if (state.sorts) {
      // Lo que el usuario dejó gana al orden inicial del esquema, también si lo había quitado.
      this.sortInitialised = true;
      this.sorts = this.multiSort ? state.sorts! : state.sorts!.slice(0, 1);
    }
    if (state.filter != null && this.hasFilter) this.filterText = state.filter;
    if (state.columnFilters) this.columnFilters = state.columnFilters;
    if (state.pageSize != null && this.props['pageSize'] && this.pageSizeOptions.includes(state.pageSize)) this.pageSizeChoice = state.pageSize;
    if (state.pinned) this.pinnedKeys = state.pinned;
    if (state.order) this.orderKeys = state.order;
    if (state.widths) this.widths = state.widths;
    // En modo server la primera petición lleva lo que se restauró.
    this.appliedFilter = this.filterText.trim();
    this.appliedColumnFilters = this.activeColumnFilters();
  }

  private saveState(): void {
    const storage = this.storage;
    if (!storage) return;
    this.applyDefaultSort();
    const state: DfTableState = {
      sorts: this.sorts,
      filter: this.filterText,
      columnFilters: this.columnFilters as Record<string, string>,
      ...(this.pageSizeChoice != null ? { pageSize: this.pageSizeChoice } : {}),
      ...(this.pinnable && this.pinnedKeys ? { pinned: this.pinnedKeys } : {}),
      ...(this.reorderable && this.orderKeys ? { order: this.orderKeys } : {}),
      ...(this.resizable && this.widths ? { widths: this.widths } : {}),
    };
    try {
      storage.setItem(this.stateKey, JSON.stringify(state));
    } catch {
      // Almacén lleno o bloqueado: la tabla sigue funcionando sin recordar.
    }
  }

  get hasColumnFilters(): boolean {
    return this.columns.some((c) => c.filter);
  }

  get exportConfig(): { filename: string } | undefined {
    return this.props['exportCsv'] as { filename: string } | undefined;
  }

  /** Hay algún filtro puesto (buscador o columna). */
  get filtering(): boolean {
    return this.filterText.trim() !== '' || Object.keys(this.activeColumnFilters()).length > 0;
  }

  get emptyMessage(): string {
    return (this.props['emptyMessage'] as string | undefined) || this.texts.empty;
  }

  get source(): DfTableSource | undefined {
    return this.props['source'] as DfTableSource | undefined;
  }

  /** El servicio entrega las páginas ya filtradas, ordenadas y recortadas. */
  get serverSide(): boolean {
    return this.source?.mode === 'server';
  }

  get loading(): boolean {
    return this.loadState === 'loading';
  }

  get failed(): boolean {
    return this.loadState === 'error';
  }

  get errorMessage(): string {
    return (this.props['errorMessage'] as string | undefined) || this.texts.error;
  }

  /** Filas de origen: las del servicio (`source`), la propiedad del modelo (`dataKey`) o las del propio esquema. */
  get sourceRows(): Row[] {
    if (this.source) return this.remoteRows;
    const dataKey = this.props['dataKey'] as string | undefined;
    const data = dataKey ? getByPath(rootModel(this.field), dataKey) : this.props['staticRows'];
    return Array.isArray(data) ? (data as Row[]).filter((r) => r && typeof r === 'object') : [];
  }

  /** Filas que cumplen el filtro: el total del servidor, o las que quedan en el cliente. */
  get totalRows(): number {
    return this.serverSide ? this.remoteTotal : this.processed.length;
  }

  // --- Carga desde el servicio -------------------------------------------------

  ngOnInit(): void {
    this.restoreState();
    // Desde fuera no hay evento del DOM que marque la vista: la tabla se marca ella misma.
    this.controls?.set(this.tableId, {
      selectAll: () => { this.selectAll(); this.cdr.markForCheck(); },
      clearSelection: () => { this.clearSelection(); this.cdr.markForCheck(); },
    });
    this.filterInput$.pipe(debounceTime(FILTER_DEBOUNCE_MS), takeUntil(this.destroyed$)).subscribe(() => {
      this.appliedFilter = this.filterText.trim();
      this.appliedColumnFilters = this.activeColumnFilters();
      this.pageIndex = 0;
      this.load(true);
    });
    this.jobs$
      .pipe(
        switchMap((job) => {
          if (!job) return EMPTY;
          if (!this.provider) {
            console.warn(`[dynamic-forms] table.source (${job.endpoint}) sin DF_TABLE_PROVIDER registrado.`);
            return of(null);
          }
          return this.provider.load(job.endpoint, job.request).pipe(
            map((result) => this.toPage(result)),
            catchError(() => of(null)),
          );
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe((page) => {
        if (page) {
          this.remoteRows = page.rows;
          this.remoteTotal = page.total;
          this.loadState = 'idle';
        } else {
          this.remoteRows = [];
          this.remoteTotal = 0;
          this.loadState = 'error';
        }
        this.cdr.markForCheck();
      });
  }

  /** Recarga la tabla cuando cambia el valor de alguno de los campos de `source.dependsOn`. */
  ngDoCheck(): void {
    if (!this.source) return;
    const key = JSON.stringify(this.params());
    if (key === this.paramsKey) return;
    this.paramsKey = key;
    this.pageIndex = 0;
    this.load();
  }

  ngOnDestroy(): void {
    if (this.controls?.get(this.tableId)) this.controls.delete(this.tableId);
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private params(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const dep of this.source?.dependsOn ?? []) out[paramName(dep)] = readPath(this.field, dep);
    return out;
  }

  private toPage(result: DfTablePage | Row[]): DfTablePage {
    const isRow = (r: unknown): r is Row => !!r && typeof r === 'object' && !Array.isArray(r);
    const rows = (Array.isArray(result) ? result : result?.rows ?? []).filter(isRow);
    const total = !Array.isArray(result) && Number.isFinite(result?.total) ? Number(result.total) : rows.length;
    return { rows, total };
  }

  /** Pide al servicio las filas que toquen ahora. */
  reload(): void {
    this.load();
  }

  /** `keepSelection`: un cambio de página, orden o filtro no vacía una selección múltiple que tiene `selectionKey`. */
  private load(keepSelection = false): void {
    const source = this.source;
    if (!source) return;
    // Lo seleccionado ya no tiene por qué existir en las filas nuevas.
    if (this.selected) {
      const lost = this.selected;
      this.selected = null;
      // Se avisa fuera del ciclo de detección en el que estamos (ngDoCheck).
      queueMicrotask(() => this.events?.select({ tableId: this.tableId, row: null, rows: [], changed: { rows: [lost], selected: false } }));
    }
    if (this.selection.size && !(keepSelection && this.selectionKey)) {
      const lost = this.selectedRows;
      this.selection.clear();
      queueMicrotask(() => this.events?.select({ tableId: this.tableId, row: null, rows: [], changed: { rows: lost, selected: false } }));
    }
    const params = this.params();
    this.waiting = this.source?.requireParams !== false && Object.values(params).some((v) => v == null || v === '');
    if (this.waiting) {
      this.remoteRows = [];
      this.remoteTotal = 0;
      this.loadState = 'idle';
      this.jobs$.next(null);
      return;
    }
    this.applyDefaultSort();
    const server = this.serverSide;
    const request: DfTableRequest = {
      page: server ? this.currentPage : 0,
      pageSize: server ? this.pageSize : null,
      sort: server ? (this.sorts[0] ?? null) : null,
      sorts: server ? this.sorts : [],
      filter: server ? this.appliedFilter : '',
      columnFilters: server ? this.appliedColumnFilters : {},
      params,
    };
    this.loadState = 'loading';
    this.jobs$.next({ endpoint: source.endpoint, request });
  }

  get pageSizeOptions(): number[] {
    return (this.props['pageSizeOptions'] as number[] | undefined) ?? DEFAULT_PAGE_SIZES;
  }

  /** Filas por página; null si la tabla no pagina. */
  get pageSize(): number | null {
    const base = this.props['pageSize'] as number | undefined;
    return this.pageSizeChoice ?? base ?? null;
  }

  private applyDefaultSort(): void {
    if (this.sortInitialised) return;
    this.sortInitialised = true;
    const sorts = (this.props['sorts'] as { key: string; direction: 'asc' | 'desc' }[] | undefined) ?? [];
    this.sorts = this.multiSort ? sorts : sorts.slice(0, 1);
  }

  /** Todas las filas tras filtrar y ordenar (sin paginar). */
  get processed(): Row[] {
    this.applyDefaultSort();
    const rows = this.sourceRows;
    // En modo server el servicio ya filtró y ordenó.
    if (this.serverSide) return rows;
    const c = this.cache;
    const columnKey = JSON.stringify(this.columnFilters);
    const sortsKey = JSON.stringify(this.sorts);
    if (c && c.rows === rows && c.length === rows.length && c.filter === this.filterText && c.columnFilters === columnKey
      && c.sorts === sortsKey) {
      return c.result;
    }
    let result = this.hasFilter ? filterRows(rows, this.columns, this.filterText, (this.props['searchKeys'] as string[] | undefined) ?? []) : rows;
    result = filterByColumns(result, this.columns, this.columnFilters);
    const keys = this.sorts.flatMap((s) => {
      const col = this.columns.find((x) => x.key === s.key);
      return col ? [{ col, direction: s.direction }] : [];
    });
    if (keys.length) result = sortRowsBy(result, keys);
    this.cache = { rows, length: rows.length, filter: this.filterText, columnFilters: columnKey, sorts: sortsKey, result };
    return result;
  }

  get pageCount(): number {
    const size = this.pageSize;
    return size ? Math.max(1, Math.ceil(this.totalRows / size)) : 1;
  }

  /** Página actual, sin salirse si las filas han bajado de número. */
  get currentPage(): number {
    return Math.min(this.pageIndex, this.pageCount - 1);
  }

  get visibleRows(): Row[] {
    const size = this.pageSize;
    if (!size || this.serverSide) return this.processed;
    const start = this.currentPage * size;
    return this.processed.slice(start, start + size);
  }

  /** "11–20 de 45" */
  get range(): string {
    const total = this.totalRows;
    const size = this.pageSize;
    if (!size || total === 0) return `${total}`;
    const start = this.currentPage * size;
    return fillText(this.texts.range, { from: start + 1, to: Math.min(total, start + size), total });
  }

  /** Ancho de una columna en %: su `col` frente a la suma de todas (una pista, la tabla se ajusta al contenido). */
  width(col: DfResolvedColumn): number {
    const total = this.columns.reduce((sum, c) => sum + c.col, 0);
    return Math.round((col.col / total) * 1000) / 10;
  }

  /** El HTML crudo de una celda `html`; el `[innerHTML]` de la plantilla lo sanea. */
  html(row: Row, col: DfResolvedColumn): string {
    const value = getByPath(row, col.key);
    return typeof value === 'string' ? value : '';
  }

  private get slots(): DfTableSlots | undefined {
    return this.options?.formState?.[DF_TABLE_SLOTS] as DfTableSlots | undefined;
  }

  /** Plantilla de la app para las celdas de la columna (`template`), si la hay. */
  cellTemplate(col: DfResolvedColumn): TemplateRef<DfCellContext> | null {
    return col.template ? this.slots?.cell(col.template) ?? null : null;
  }

  cellContext(row: Row, col: DfResolvedColumn): DfCellContext {
    return { $implicit: row, row, value: getByPath(row, col.key), column: col.key };
  }

  /** Plantilla de la app para la tabla vacía (`dfEmpty`), si la hay. */
  get emptyTemplate(): TemplateRef<{ $implicit: string }> | null {
    return this.slots?.empty(this.tableId) ?? null;
  }

  /** Clase de la insignia de una celda `badge`: `df-badge df-badge--ok` (neutra si el valor no tiene variante). */
  badgeClass(row: Row, col: DfResolvedColumn): string {
    const value = getByPath(row, col.key);
    const variant = value == null ? undefined : col.variants?.[String(value)];
    return variant ? `df-badge df-badge--${variant}` : 'df-badge';
  }

  /** Destino de una celda `link` (null si falta algún valor de la fila: se pinta el texto sin enlace). */
  href(row: Row, col: DfResolvedColumn): string | null {
    return resolveHref(row, col.href);
  }

  /**
   * Clic en un enlace `link`: se emite `tableNavigate` y la app decide si navega ella (`preventDefault`). Con Ctrl,
   * Cmd, Mayús, Alt o un botón que no sea el izquierdo no se emite: el navegador abre una pestaña o ventana.
   */
  onLink(event: MouseEvent, row: Row, col: DfResolvedColumn): void {
    event.stopPropagation();
    const href = this.href(row, col);
    if (!href || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    this.events?.navigate({ tableId: this.tableId, column: col.key, href, row, originalEvent: event });
  }

  text(row: Row, col: DfResolvedColumn): string {
    return cellText(row, col);
  }

  ariaSort(col: DfResolvedColumn): 'ascending' | 'descending' | 'none' | null {
    if (!col.sortable) return null;
    const s = this.sorts.find((x) => x.key === col.key);
    if (!s) return 'none';
    return s.direction === 'asc' ? 'ascending' : 'descending';
  }

  get multiSort(): boolean {
    return this.props['multiSort'] === true;
  }

  /** Posición (desde 1) de la columna en el orden, solo cuando hay varias columnas ordenando. */
  sortPosition(col: DfResolvedColumn): number | null {
    const i = this.sorts.findIndex((s) => s.key === col.key);
    return this.sorts.length > 1 && i >= 0 ? i + 1 : null;
  }

  sortArrow(col: DfResolvedColumn): string {
    const s = this.sorts.find((x) => x.key === col.key);
    return s ? (s.direction === 'asc' ? '▲' : '▼') : '';
  }

  /**
   * Pulsar la cabecera: ascendente, luego descendente, luego sin orden. Con `multiSort`, Mayús + clic añade la
   * columna al orden (o cambia su sentido, o la quita) sin tocar las demás; un clic sin Mayús ordena solo por ella.
   */
  sortBy(col: DfResolvedColumn, event?: Event): void {
    if (!col.sortable) return;
    this.applyDefaultSort();
    const current = this.sorts.find((s) => s.key === col.key);
    const next = (s: typeof current) => (!s ? 'asc' : s.direction === 'asc' ? 'desc' : null);
    if (this.multiSort && (event as MouseEvent | undefined)?.shiftKey) {
      const direction = next(current);
      const others = this.sorts.filter((s) => s.key !== col.key);
      this.sorts = !direction ? others : current ? this.sorts.map((s) => (s.key === col.key ? { key: s.key, direction } : s)) : [...others, { key: col.key, direction }];
    } else {
      // Sin Mayús solo se cicla si esta columna ya es el único orden; si no, empieza de cero con ella.
      const alone = this.sorts.length === 1 && !!current;
      const direction = alone ? next(current) : 'asc';
      this.sorts = direction ? [{ key: col.key, direction }] : [];
    }
    this.pageIndex = 0;
    this.saveState();
    if (this.serverSide) this.load(true);
  }

  onFilter(event: Event): void {
    this.filterText = (event.target as HTMLInputElement).value;
    this.filtersChanged();
  }

  filterKind(col: DfResolvedColumn): 'text' | 'select' {
    return columnFilterKind(col);
  }

  filterOptions(col: DfResolvedColumn): { value: string; label: string }[] {
    return columnFilterOptions(col);
  }

  onColumnFilter(col: DfResolvedColumn, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.columnFilters = { ...this.columnFilters, [col.key]: value };
    this.filtersChanged();
  }

  /** Filtros por columna con algo escrito o elegido. */
  private activeColumnFilters(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of this.columns) {
      const v = (this.columnFilters[c.key] ?? '').trim();
      if (c.filter && v) out[c.key] = v;
    }
    return out;
  }

  private filtersChanged(): void {
    this.saveState();
    if (this.serverSide) {
      this.filterInput$.next();
      return;
    }
    this.pageIndex = 0;
  }

  goTo(page: number): void {
    this.pageIndex = Math.min(Math.max(0, page), this.pageCount - 1);
    if (this.serverSide) this.load(true);
  }

  onPageSize(event: Event): void {
    this.pageSizeChoice = Number((event.target as HTMLSelectElement).value);
    this.pageIndex = 0;
    this.saveState();
    if (this.serverSide) this.load(true);
  }

  private get events(): DfTableEvents | undefined {
    return this.options?.formState?.[DF_TABLE_EVENTS] as DfTableEvents | undefined;
  }

  /** La acción se muestra en esta fila (sin `showWhen` se muestra siempre). */
  actionVisible(row: Row, action: DfTableAction): boolean {
    return !action.showWhen || this.evaluator.evaluate(action.showWhen, rootModel(this.field), row, contextOf(this.field));
  }

  actionDisabled(row: Row, action: DfTableAction): boolean {
    return !!action.disabledWhen && this.evaluator.evaluate(action.disabledWhen, rootModel(this.field), row, contextOf(this.field));
  }

  /** Trazado SVG del icono incluido, o null si `icon` es un texto que se pinta tal cual. */
  iconPath(action: DfTableAction): string | null {
    return action.icon ? tableIconPath(action.icon) : null;
  }

  act(row: Row, action: DfTableAction): void {
    if (this.actionDisabled(row, action) || !this.actionVisible(row, action)) return;
    this.events?.action({ tableId: this.props['tableId'] as string, action: action.name, row });
  }

  get tableId(): string {
    return this.props['tableId'] as string;
  }

  private get selectionKey(): string | undefined {
    return this.props['selectionKey'] as string | undefined;
  }

  private idOf(row: Row): unknown {
    const key = this.selectionKey;
    if (!key) return row;
    const id = getByPath(row, key);
    return id == null ? row : id;
  }

  /** Filas marcadas con `selectable: 'multiple'`. */
  get selectedRows(): Row[] {
    return [...this.selection.values()];
  }

  /** Última fila que se marcó o desmarcó con el ratón: donde empieza un rango con Shift. */
  private anchor: Row | null = null;

  /** Con Shift apretado el navegador selecciona texto entre los dos clics; aquí estorba. */
  onRowMouseDown(event: MouseEvent): void {
    if (this.multiple && event.shiftKey) event.preventDefault();
  }

  /** Hay alguna fila que la casilla de la cabecera pueda marcar. */
  get headerRowsAvailable(): boolean {
    return this.headerRows.length > 0;
  }

  /** La fila admite selección (sin `selectableWhen` todas la admiten). */
  rowSelectable(row: Row): boolean {
    const rule = this.props['selectableWhen'] as DfRule | undefined;
    return !rule || this.evaluator.evaluate(rule, rootModel(this.field), row, contextOf(this.field));
  }

  /** Filas que marca la casilla de la cabecera: las seleccionables de la página o de todo lo filtrado. */
  private get headerRows(): Row[] {
    const rows = this.props['headerSelects'] === 'page' ? this.visibleRows : this.processed;
    return this.props['selectableWhen'] ? rows.filter((r) => this.rowSelectable(r)) : rows;
  }

  toggle(row: Row, event?: Event): void {
    if (!this.selectable || !this.rowSelectable(row)) return;
    if (this.multiple) {
      const rows = this.visibleRows;
      const from = this.anchor ? rows.indexOf(this.anchor) : -1;
      if ((event as MouseEvent | undefined)?.shiftKey && from >= 0) {
        // Rango con Shift: todas las filas de la página entre la última pulsada y esta se añaden a la selección.
        const to = rows.indexOf(row);
        const added: Row[] = [];
        for (const r of rows.slice(Math.min(from, to), Math.max(from, to) + 1)) {
          if (!this.rowSelectable(r)) continue;
          if (!this.selection.has(this.idOf(r))) added.push(r);
          this.selection.set(this.idOf(r), r);
        }
        this.anchor = row;
        this.emitSelection(added, true);
        return;
      }
      const id = this.idOf(row);
      const wasSelected = this.selection.has(id);
      if (wasSelected) this.selection.delete(id);
      else this.selection.set(id, row);
      this.anchor = row;
      this.emitSelection([row], !wasSelected);
      return;
    }
    const previous = this.selected;
    this.selected = previous === row ? null : row;
    this.events?.select({
      tableId: this.tableId,
      row: this.selected,
      rows: this.selected ? [this.selected] : [],
      changed: { rows: [this.selected ?? previous ?? row], selected: this.selected !== null },
    });
  }

  isSelected(row: Row): boolean {
    return this.multiple ? this.selection.has(this.idOf(row)) : this.selected === row;
  }

  /** Casilla de la cabecera: todas las filas filtradas (en modo server, las de la página). */
  get allSelected(): boolean {
    const rows = this.headerRows;
    return rows.length > 0 && rows.every((r) => this.isSelected(r));
  }

  get someSelected(): boolean {
    return !this.allSelected && this.headerRows.some((r) => this.isSelected(r));
  }

  toggleAll(): void {
    const all = this.allSelected;
    const changed: Row[] = [];
    for (const row of this.headerRows) {
      const id = this.idOf(row);
      if (all) {
        this.selection.delete(id);
        changed.push(row);
      } else {
        if (!this.selection.has(id)) changed.push(row);
        this.selection.set(id, row);
      }
    }
    this.emitSelection(changed, !all);
  }

  private get controls(): Map<string, DfTableControls> | undefined {
    return this.options?.formState?.[DF_TABLE_CONTROLS] as Map<string, DfTableControls> | undefined;
  }

  /** Marca las filas que marcaría la casilla de la cabecera (`selectable: 'multiple'`). Es la misma lógica que `toggleAll` cuando no están todas marcadas. */
  selectAll(): void {
    if (!this.multiple) return;
    const changed = this.headerRows.filter((r) => !this.selection.has(this.idOf(r)));
    for (const row of changed) this.selection.set(this.idOf(row), row);
    if (changed.length) this.emitSelection(changed, true);
  }

  /** Quita toda la selección, también la de otras páginas. No emite nada si no había nada marcado. */
  clearSelection(): void {
    this.anchor = null;
    if (this.multiple) {
      const changed = this.selectedRows;
      this.selection.clear();
      if (changed.length) this.emitSelection(changed, false);
    } else if (this.selected) {
      const previous = this.selected;
      this.selected = null;
      this.events?.select({ tableId: this.tableId, row: null, rows: [], changed: { rows: [previous], selected: false } });
    }
  }

  private emitSelection(changed: Row[], selected: boolean): void {
    this.events?.select({ tableId: this.tableId, row: null, rows: this.selectedRows, changed: { rows: changed, selected } });
  }

  // --- Exportar a CSV ----------------------------------------------------------

  /** Texto del botón: con filas marcadas exporta solo esas. */
  get exportLabel(): string {
    return this.multiple && this.selection.size ? fillText(this.texts.exportSelection, { n: this.selection.size }) : this.texts.exportCsv;
  }

  exportCsv(): void {
    const config = this.exportConfig;
    if (!config || this.exporting) return;
    this.exportFailed = false;
    const save = (rows: Row[]) => this.download(csvFileName(config.filename), toCsv(rows, this.columns));
    if (this.multiple && this.selection.size) return save(this.selectedRows);
    const source = this.source;
    if (!(this.serverSide && source)) return save(this.processed);
    // Modo server: la tabla solo tiene la página actual, así que se piden al servicio todas las filas del filtro.
    if (!this.provider) {
      this.exportFailed = true;
      return;
    }
    this.exporting = true;
    const request: DfTableRequest = {
      page: 0,
      pageSize: Math.max(1, this.remoteTotal),
      sort: this.sorts[0] ?? null,
      sorts: this.sorts,
      filter: this.appliedFilter,
      columnFilters: this.appliedColumnFilters,
      params: this.params(),
    };
    this.provider.load(source.endpoint, request).pipe(take(1), map((r) => this.toPage(r)), takeUntil(this.destroyed$)).subscribe({
      next: (page) => {
        this.exporting = false;
        save(page.rows);
        this.cdr.markForCheck();
      },
      error: () => {
        this.exporting = false;
        this.exportFailed = true;
        this.cdr.markForCheck();
      },
    });
  }

  private download(name: string, csv: string): void {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }
}
