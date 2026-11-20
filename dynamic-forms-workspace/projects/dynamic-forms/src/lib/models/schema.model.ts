/**
 * Tipos TypeScript del SchemaContract (openspec.yaml).
 * Son la representación 1:1 del JSON que emite el backend / Appian.
 */

export type DfFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'hidden'
  | 'currency';

/**
 * Nombre de un tipo Formly registrado por la app con provideDynamicForms({ types }).
 * El `& Record<never, never>` conserva el autocompletado de DfFieldType.
 */
export type DfCustomFieldType = string & Record<never, never>;

export const DF_FIELD_TYPES: readonly DfFieldType[] = [
  'text', 'email', 'password', 'number', 'textarea',
  'select', 'multiselect', 'radio', 'checkbox', 'date', 'hidden', 'currency',
];

export interface DfOption {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
}

export interface DfStaticOptions {
  source: 'static';
  items: DfOption[];
}

export interface DfDependentOptions {
  source: 'dependent';
  dependsOn: string;
  map: Record<string, DfOption[]>;
  resetOnChange?: boolean;
}

export interface DfRemoteOptions {
  source: 'remote';
  endpoint: string;
  dependsOn?: string[];
  resetOnChange?: boolean;
}

export type DfOptionsSource = DfOption[] | DfStaticOptions | DfDependentOptions | DfRemoteOptions;

// ---------------------------------------------------------------------------
// ConditionalLogicContract
// ---------------------------------------------------------------------------
export type DfOperator =
  | 'eq' | 'neq' | 'in' | 'nin'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'empty' | 'notEmpty' | 'truthy' | 'falsy'
  | 'matches' | 'contains';

export const DF_OPERATORS: readonly DfOperator[] = [
  'eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte',
  'empty', 'notEmpty', 'truthy', 'falsy', 'matches', 'contains',
];

export interface DfCondition {
  field: string;
  operator: DfOperator;
  value?: unknown;
}

export interface DfRuleGroup {
  all?: DfRule[];
  any?: DfRule[];
  not?: DfRule;
}

export type DfRule = DfCondition | DfRuleGroup;

export interface DfConditionalLogic {
  showWhen?: DfRule;
  hideWhen?: DfRule;
  requiredWhen?: DfRule;
  disabledWhen?: DfRule;
  resetOnHide?: boolean;
}

// ---------------------------------------------------------------------------
// ValidationContract
// ---------------------------------------------------------------------------
export interface DfValidatorRef {
  name: string;
  args?: Record<string, unknown>;
  message?: string;
}

export interface DfValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  validators?: DfValidatorRef[];
  asyncValidators?: DfValidatorRef[];
  messages?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Nodos
// ---------------------------------------------------------------------------
export interface DfFieldLayout {
  col?: number;
  order?: number;
  cssClass?: string;
}

export interface DfField {
  key: string;
  type: DfFieldType | DfCustomFieldType;
  label?: string;
  placeholder?: string;
  description?: string;
  defaultValue?: unknown;
  readonly?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  options?: DfOptionsSource;
  validation?: DfValidation;
  logic?: DfConditionalLogic;
  layout?: DfFieldLayout;
  props?: Record<string, unknown>;
}

export interface DfGroup {
  type: 'group';
  id: string;
  title?: string;
  description?: string;
  columns?: number;
  cssClass?: string;
  logic?: DfConditionalLogic;
  fields: DfNode[];
}

export type DfArrayDisplay = 'rows' | 'table';

export type DfArrayTotalOp = 'sum' | 'count' | 'avg' | 'min' | 'max';

export const DF_ARRAY_TOTAL_OPS: readonly DfArrayTotalOp[] = ['sum', 'count', 'avg', 'min', 'max'];

/**
 * Resumen que se muestra bajo la lista y se recalcula con cada cambio. Solo se muestra: no se
 * guarda en el modelo. `field` es un campo `number` o `currency` de la fila; `count` no lo necesita
 * (sin `field` cuenta las filas, con `field` las que lo tienen relleno). Un total de un campo
 * `currency` se muestra con su moneda y su formato.
 */
export interface DfArrayTotal {
  label: string;
  op: DfArrayTotalOp;
  field?: string;
}

/**
 * Lista repetible de filas: el modelo guarda `key: [{...}, {...}]`, un objeto por fila con los `fields` del nodo.
 * Dentro de una fila, una condición puede apuntar a otro campo de la misma fila con `./campo`.
 */
export interface DfArray {
  type: 'array';
  key: string;
  title?: string;
  description?: string;
  /** Nombre de cada fila en la disposición `rows` ("Línea 1", "Línea 2"…). */
  itemLabel?: string;
  addLabel?: string;
  removeLabel?: string;
  minItems?: number;
  maxItems?: number;
  totals?: DfArrayTotal[];
  /** `rows`: una tarjeta por fila. `table`: cabecera de columnas y una línea por fila. Por defecto `rows`. */
  display?: DfArrayDisplay;
  /** Campos por línea dentro de cada fila (solo `rows`). */
  columns?: number;
  cssClass?: string;
  logic?: DfConditionalLogic;
  fields: DfNode[];
}

export type DfTableColumnType = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'map' | 'badge' | 'link';

/** Variantes de color de una insignia (`df-badge--ok|warn|error|info`). */
export type DfBadgeVariant = 'ok' | 'warn' | 'error' | 'info';

export const DF_BADGE_VARIANTS: readonly DfBadgeVariant[] = ['ok', 'warn', 'error', 'info'];

export const DF_TABLE_COLUMN_TYPES: readonly DfTableColumnType[] = [
  'text', 'number', 'currency', 'date', 'datetime', 'boolean', 'map', 'badge', 'link',
];

export interface DfTableColumn {
  /** Propiedad de cada fila; admite puntos (`titular.nombre`). */
  key: string;
  label: string;
  /** Cómo se muestra y se ordena el valor. Por defecto `text`. */
  type?: DfTableColumnType;
  /** Con `type: "map"`: valor de la fila → texto que se muestra (`{ "ADIF": "Organismo" }`). */
  map?: Record<string, string>;
  /**
   * Con `type: "badge"`: valor de la fila → variante de color de la insignia (`ok`, `warn`, `error`, `info`); un valor sin
   * entrada se pinta con la insignia neutra. El texto sale de `map` (o es el propio valor).
   */
  variants?: Record<string, DfBadgeVariant>;
  /**
   * Con `type: "link"`: destino del enlace; `{clave}` se sustituye por la propiedad de la fila (con puntos, codificada
   * para URL): `/ejecuciones/{id}`. Debe empezar por `/`, `#`, `http://` o `https://`. El texto es el valor de la celda.
   */
  href?: string;
  /**
   * Nombre de una plantilla `<ng-template dfCell="nombre" let-row>` de la app que pinta las celdas de esta columna.
   * El valor sigue siendo el de `key` para filtrar, ordenar y exportar; sin plantilla con ese nombre se pinta el texto.
   */
  template?: string;
  /** Si se puede ordenar pulsando la cabecera. Por defecto `true`. */
  sortable?: boolean;
  /** Peso relativo del ancho de la columna (1-12). Por defecto 1. */
  col?: number;
  /** Moneda de una columna `currency`; sin ella, la de la app. */
  currency?: string;
  /**
   * Muestra un filtro bajo la cabecera de esta columna: un cuadro de texto (contiene, sin mayúsculas ni
   * acentos), o un desplegable con las opciones en las columnas `map` y `boolean`.
   */
  filter?: boolean;
  /**
   * Deja la columna fija a la izquierda al desplazar la tabla en horizontal. Solo las primeras columnas
   * pueden ser fijas: una columna fija no puede ir detrás de una que no lo sea.
   */
  frozen?: boolean;
  /**
   * La celda se pinta como HTML (enlaces, insignias) en vez de texto. Solo en columnas `text`. El HTML pasa por el
   * sanitizador de Angular (sin scripts, `on*`, `style` ni `javascript:`); el filtro, la ordenación y el CSV usan el
   * texto sin etiquetas. Las insignias son `<span class="df-badge df-badge--ok|warn|error|info">`.
   */
  html?: boolean;
}

/** Exportación de la tabla a CSV (`exportCsv`). */
export interface DfTableExport {
  /** Nombre del fichero, con o sin `.csv`. Por defecto, el `id` de la tabla. */
  filename?: string;
}

/** Botón por fila: al pulsarlo `<dynamic-form>` emite `tableAction` con la fila. */
export interface DfTableAction {
  name: string;
  /** Texto del botón; con `icon` es solo el nombre accesible (y el tooltip si no hay `tooltip`). */
  label: string;
  /**
   * Botón de icono. Un nombre de `DF_TABLE_ICONS` (`view`, `edit`, `delete`, `download`, `add`, `check`, `close`) se
   * pinta como SVG; cualquier otro texto corto (un emoji, un símbolo) se pinta tal cual.
   */
  icon?: string;
  /** Texto emergente del botón. Por defecto, `label`. */
  tooltip?: string;
  /** Solo se muestra en las filas que cumplen la regla (`./campo` lee de la fila, el resto del modelo del formulario). */
  showWhen?: DfRule;
  /** Se muestra deshabilitado en las filas que cumplen la regla. */
  disabledWhen?: DfRule;
}

/** Iconos incluidos para `DfTableAction.icon`. */
export const DF_TABLE_ICONS = ['view', 'edit', 'delete', 'download', 'add', 'check', 'close'] as const;

/**
 * De dónde salen las filas de una tabla: un servicio de la app (`DfTableProvider`).
 * `client`: el servicio devuelve todas las filas y la tabla filtra, ordena y pagina en el cliente.
 * `server`: el servicio devuelve una página cada vez (con el orden y el filtro que pida el usuario) y
 * el total de filas; necesita `pageSize`.
 */
export interface DfTableSource {
  endpoint: string;
  mode?: 'client' | 'server';
  /** Campos del formulario cuyo valor se envía como parámetros; si cambia alguno, la tabla se recarga. */
  dependsOn?: string[];
  /**
   * `dependsOn` nombra claves del modelo que no son campos de este esquema: las rellena la app (por
   * ejemplo con los criterios de otro formulario al pulsar "Buscar"). El validador no las busca entre los campos.
   */
  externalParams?: boolean;
  /** Con `false` la tabla carga aunque algún parámetro de `dependsOn` esté vacío. Por defecto `true`. */
  requireParams?: boolean;
}

export interface DfTableSort {
  key: string;
  direction?: 'asc' | 'desc';
}

/**
 * Tabla de datos de solo lectura, no un campo del formulario: no escribe nada en el modelo.
 * Las filas vienen de un servicio (`source`), del propio esquema (`rows`) o de una propiedad del
 * modelo (`dataKey`), que puede ser un array que llegue o cambie después. Filtro, orden y paginación
 * se hacen en el cliente, salvo con `source.mode: "server"`, donde los hace el servicio.
 */
export interface DfTable {
  type: 'table';
  id: string;
  title?: string;
  description?: string;
  columns: DfTableColumn[];
  rows?: Record<string, unknown>[];
  /** Ruta (con puntos) del modelo raíz que contiene el array de filas. Tiene prioridad sobre `rows`. */
  dataKey?: string;
  /** Filas que carga un servicio. No se combina con `rows` ni `dataKey`. */
  source?: DfTableSource;
  /** Texto cuando la carga falla. */
  errorMessage?: string;
  /** Muestra un cuadro de búsqueda sobre el texto visible de las columnas. */
  filter?: boolean;
  filterLabel?: string;
  /**
   * Claves de la fila (con puntos) en las que también busca el cuadro de búsqueda, aunque no sean columnas visibles.
   * Solo cuenta en modo `client`; en `server` busca el servicio.
   */
  searchKeys?: string[];
  /** Filas por página. Sin él no hay paginación. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /**
   * Orden inicial. Una lista de varios solo vale con `multiSort`: la primera manda y las siguientes desempatan.
   */
  sort?: DfTableSort | DfTableSort[];
  /**
   * Ordenar por varias columnas: Mayús + clic en una cabecera la añade al orden (o cambia su sentido, y a la
   * tercera la quita). Un clic sin Mayús ordena solo por esa columna. Con varias, la cabecera muestra su posición.
   */
  multiSort?: boolean;
  /**
   * Selección de filas; se emite `tableSelect`. `true` o `'single'`: una fila a la vez, con un clic.
   * `'multiple'`: una columna de casillas y una casilla en la cabecera que marca todas las filas filtradas
   * (en modo `server`, las de la página).
   */
  selectable?: boolean | 'single' | 'multiple';
  /**
   * Solo las filas que cumplen la regla se pueden seleccionar (`./campo` lee de la fila, el resto del modelo del
   * formulario). Las demás no tienen casilla activa ni responden al clic, y la casilla de la cabecera las salta.
   */
  selectableWhen?: DfRule;
  /**
   * Qué marca la casilla de la cabecera con `selectable: 'multiple'`: `filtered` (por defecto) todas las filas que
   * pasan el filtro, `page` solo las de la página visible. En modo `server` siempre es la página.
   */
  headerSelects?: 'filtered' | 'page';
  /**
   * Propiedad de la fila (con puntos) que la identifica. Con `selectable: 'multiple'` hace que la selección
   * sobreviva a cambiar de página, orden o filtro en modo `server`; sin ella se identifican por objeto y
   * esos cambios la vacían.
   */
  selectionKey?: string;
  /**
   * Pone en cada cabecera un botón para fijar o soltar la columna. Una columna fijada pasa al final del bloque de
   * columnas fijas y, al soltarla, vuelve a su sitio. Parte de lo que digan `columns[].frozen`; lo que elija el usuario
   * solo vive mientras la tabla está en pantalla.
   */
  pinnableColumns?: boolean;
  /**
   * El borde derecho de cada cabecera se arrastra para cambiar el ancho de la columna (o con las flechas
   * izquierda y derecha cuando tiene el foco; doble clic restablece los anchos). Desde el primer cambio los
   * anchos pasan a píxeles y la tabla se desplaza en horizontal si no cabe. Se recuerda con `persistState`.
   */
  resizableColumns?: boolean;
  /**
   * Las cabeceras se pueden arrastrar para cambiar el orden de las columnas (o con Alt + flecha izquierda o
   * derecha). Una columna fija solo se mueve entre las fijas y una normal entre las normales. Se recuerda con
   * `persistState`.
   */
  reorderableColumns?: boolean;
  /**
   * Recuerda el orden, el buscador, los filtros de columna, las filas por página y las columnas fijadas entre
   * visitas. `'session'` (o `true`) lo guarda en `sessionStorage`; `'local'`, en `localStorage`. No guarda la
   * página ni la selección.
   */
  persistState?: boolean | 'session' | 'local';
  /** Clave con la que se guarda el estado; por defecto, el `id` de la tabla. Cámbiala si dos pantallas comparten `id`. */
  stateKey?: string;
  /** Botón «Exportar CSV». `true` usa el `id` como nombre del fichero. */
  exportCsv?: boolean | DfTableExport;
  actions?: DfTableAction[];
  emptyMessage?: string;
  cssClass?: string;
  logic?: DfConditionalLogic;
}

/**
 * Hueco para un bloque de la app entre los campos del esquema (una vista previa, un resumen, un panel). No es un campo:
 * no tiene `key` ni toca el modelo. La app lo rellena con `<ng-template dfSlot="nombre">` dentro de `<dynamic-form>`.
 * Ocupa la fila entera. Puede ir en la raíz o dentro de un grupo, no dentro de una lista repetible.
 */
export interface DfSlot {
  type: 'slot';
  name: string;
  cssClass?: string;
  logic?: DfConditionalLogic;
}

export type DfNode = DfField | DfGroup | DfArray | DfTable | DfSlot;

export function isDfSlot(node: DfNode): node is DfSlot {
  return (node as DfSlot).type === 'slot';
}

export interface DfFormLayout {
  columns?: number;
  gap?: string;
  /**
   * Valor por defecto de `logic.resetOnHide` en todo el esquema: con `false` un campo oculto conserva su valor en el
   * modelo. Un `logic.resetOnHide` propio de un nodo manda sobre este, y este sobre `defaultResetOnHide` de la app.
   */
  resetOnHide?: boolean;
}

export interface DfFormSchema {
  version: '1.0';
  id: string;
  title?: string;
  description?: string;
  layout?: DfFormLayout;
  fields: DfNode[];
  meta?: Record<string, unknown>;
}

export function isDfGroup(node: DfNode): node is DfGroup {
  return (node as DfGroup).type === 'group';
}

export function isDfArray(node: DfNode): node is DfArray {
  return (node as DfArray).type === 'array';
}

export function isDfTable(node: DfNode): node is DfTable {
  return (node as DfTable).type === 'table';
}

/** Un campo de entrada: ni grupo, ni lista repetible, ni tabla. */
export function isDfField(node: DfNode): node is DfField {
  return !isDfGroup(node) && !isDfArray(node) && !isDfTable(node) && !isDfSlot(node);
}
