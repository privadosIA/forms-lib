import { Injectable, inject } from '@angular/core';
import { ConfigOption, FORMLY_CONFIG, FormlyConfig } from '@ngx-formly/core';
import { DfSchemaIssue, DfSchemaValidationResult } from '../models/config.model';
import {
  DF_ARRAY_TOTAL_OPS, DF_BADGE_VARIANTS, DF_FIELD_TYPES, DF_OPERATORS, DF_TABLE_COLUMN_TYPES, DfArray, DfCondition, DfField, DfFieldType, DfFormSchema, DfGroup, DfNode, DfRule,
  DfRuleGroup, DfTable, isDfArray, isDfField, isDfGroup, isDfSlot, isDfTable,
} from '../models/schema.model';
import { isCssLength } from '../utils/css-length';
import { NUMBER_FORMATS, WORDS_LANGUAGES, isCurrencyCode } from '../utils/currency';
import { CONTEXT_PREFIX, RELATIVE_PREFIX } from './condition-evaluator.service';
import { ValidatorRegistryService } from './validator-registry.service';

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const FILENAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_. -]*$/;
const OPTION_TYPES = new Set(['select', 'multiselect', 'radio']);
/** Operadores que no comparan contra un valor. */
const VALUELESS_OPERATORS = new Set(['empty', 'notEmpty', 'truthy', 'falsy']);

type Push = (path: string, message: string) => void;
/** Claves de los campos de la fila de una lista repetible; `null` fuera de ellas. */
/** `ctx` (o `ctx.algo`) es del contexto externo: un campo con esa clave haría ambigua la ruta `ctx.nombre`. */
const isReservedKey = (key: string): boolean => key === 'ctx' || key.startsWith('ctx.');

const SLOT_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const HREF_RE = /^(\/(?!\/)|#|https?:\/\/)\S*$/;

type RowKeys = Set<string> | null;

/** Conjunto que acepta cualquier clave: las filas de una tabla no declaran sus propiedades. */
const ANY_ROW_KEY: RowKeys = new (class extends Set<string> { override has(): boolean { return true; } })();

/**
 * Validación estructural del SchemaContract sin dependencias externas (sin ajv).
 * Comprueba lo que de verdad rompe el render: tipos, keys, referencias cruzadas
 * en condiciones/dependsOn y aliases de validadores no registrados.
 */
@Injectable({ providedIn: 'root' })
export class SchemaValidatorService {
  private readonly registry = inject(ValidatorRegistryService);
  private readonly formlyConfig = inject(FormlyConfig, { optional: true });
  /**
   * Formly aplica la config de forRoot() en diferido (al crear el primer formulario), y aquí se valida
   * antes; por eso se leen también los tipos declarados en FORMLY_CONFIG.
   */
  private readonly declaredTypes = new Set(
    ([inject(FORMLY_CONFIG, { optional: true }) ?? []] as unknown[])
      .flat(Infinity)
      .flatMap((c) => (c as ConfigOption | null)?.types?.map((t) => t.name) ?? []),
  );

  validate(schema: unknown): DfSchemaValidationResult {
    const errors: DfSchemaIssue[] = [];
    const push = (path: string, message: string) => errors.push({ path, message });

    if (!schema || typeof schema !== 'object') {
      push('$', 'El esquema debe ser un objeto');
      return { valid: false, errors };
    }
    const s = schema as Partial<DfFormSchema>;
    if (s.version !== '1.0') push('version', `Versión no soportada: ${String(s.version)}`);
    if (typeof s.id !== 'string' || !ID_RE.test(s.id)) push('id', 'id obligatorio con formato ^[A-Za-z][A-Za-z0-9_-]*$');
    const cols = s.layout?.columns;
    if (cols != null && !(Number.isInteger(cols) && cols >= 1 && cols <= 12)) push('layout.columns', 'columns entre 1 y 12');
    if (s.layout?.resetOnHide != null && typeof s.layout.resetOnHide !== 'boolean') push('layout.resetOnHide', 'resetOnHide debe ser true o false');
    if (s.layout?.gap != null && !isCssLength(s.layout.gap)) push('layout.gap', 'gap debe ser una longitud CSS (p. ej. 1rem, 12px)');
    if (!Array.isArray(s.fields) || s.fields.length === 0) {
      push('fields', 'fields debe ser un array con al menos un elemento');
      return { valid: false, errors };
    }

    // Claves absolutas (raíz del modelo). Las de dentro de una lista repetible son de su fila, no de la raíz.
    const keys = this.collectKeys(s.fields);
    this.visitNodes(s.fields, 'fields', push, keys, null, null);

    return { valid: errors.length === 0, errors };
  }

  /** Claves de los campos y listas de un nivel, atravesando grupos pero no listas (cada fila tiene las suyas). */
  private collectKeys(nodes: DfNode[]): Set<string> {
    const keys = new Set<string>();
    const walk = (list: DfNode[]) =>
      list.forEach((n) => {
        if (!n || typeof n !== 'object') return;
        if (isDfGroup(n)) walk(Array.isArray(n.fields) ? n.fields : []);
        else if (!isDfTable(n) && !isDfSlot(n) && n.key) keys.add(n.key);
      });
    walk(nodes);
    return keys;
  }

  /** `row`: contexto de la lista repetible que contiene los nodos (claves de la fila y su disposición). */
  private visitNodes(
    nodes: DfNode[], path: string, push: Push, keys: Set<string>, row: RowKeys, table: DfArray | null,
  ): void {
    nodes.forEach((node, i) => {
      const p = `${path}[${i}]`;
      if (!node || typeof node !== 'object') return push(p, 'Nodo inválido');
      if (isDfGroup(node)) {
        if (table) push(`${p}.type`, 'Una lista con display "table" solo admite campos, no grupos');
        return this.validateGroup(node, p, push, keys, row, table);
      }
      if (isDfSlot(node)) {
        if (row) push(`${p}.type`, 'Un slot no puede ir dentro de una lista repetible');
        if (typeof node.name !== 'string' || !SLOT_NAME_RE.test(node.name)) push(`${p}.name`, 'Un slot necesita name con formato ^[A-Za-z][A-Za-z0-9_-]*$');
        if (node.cssClass != null && typeof node.cssClass !== 'string') push(`${p}.cssClass`, 'cssClass debe ser un texto');
        return this.validateLogic(node.logic, `${p}.logic`, push, keys, row);
      }
      if (isDfArray(node)) return this.validateArray(node, p, push, keys, row);
      if (isDfTable(node)) {
        if (table) push(`${p}.type`, 'Una lista con display "table" solo admite campos, no tablas de datos');
        return this.validateTable(node, p, push, keys, row);
      }
      this.validateField(node, p, push, keys, row, table);
    });
  }

  private validateGroup(g: DfGroup, p: string, push: Push, keys: Set<string>, row: RowKeys, table: DfArray | null): void {
    if (typeof g.id !== 'string' || !g.id) push(`${p}.id`, 'Un grupo necesita id');
    if (g.columns != null && (g.columns < 1 || g.columns > 12)) push(`${p}.columns`, 'columns entre 1 y 12');
    if (!Array.isArray(g.fields) || g.fields.length === 0) push(`${p}.fields`, 'Un grupo necesita fields');
    else this.visitNodes(g.fields, `${p}.fields`, push, keys, row, table);
    this.validateLogic(g.logic, `${p}.logic`, push, keys, row);
  }

  private validateArray(a: DfArray, p: string, push: Push, keys: Set<string>, row: RowKeys): void {
    if (row) push(`${p}.type`, 'Una lista no puede ir dentro de otra lista');
    if (typeof a.key !== 'string' || !KEY_RE.test(a.key)) push(`${p}.key`, 'key obligatoria con formato ^[A-Za-z_][A-Za-z0-9_.]*$');
    else if (isReservedKey(a.key)) push(`${p}.key`, 'La clave ctx está reservada para el contexto externo de las condiciones (ctx.nombre)');
    if (a.display != null && a.display !== 'rows' && a.display !== 'table') push(`${p}.display`, "display debe ser 'rows' o 'table'");
    if (a.columns != null && !(Number.isInteger(a.columns) && a.columns >= 1 && a.columns <= 12)) push(`${p}.columns`, 'columns entre 1 y 12');
    const isCount = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
    if (a.minItems != null && !isCount(a.minItems)) push(`${p}.minItems`, 'minItems debe ser un entero mayor o igual que 0');
    if (a.maxItems != null && !(isCount(a.maxItems) && (a.maxItems as number) >= 1)) push(`${p}.maxItems`, 'maxItems debe ser un entero mayor o igual que 1');
    if (isCount(a.minItems) && isCount(a.maxItems) && a.minItems! > a.maxItems!) push(`${p}.maxItems`, 'maxItems no puede ser menor que minItems');
    if (!Array.isArray(a.fields) || a.fields.length === 0) {
      push(`${p}.fields`, 'Una lista necesita fields');
    } else {
      this.visitNodes(a.fields, `${p}.fields`, push, keys, this.collectKeys(a.fields), a.display === 'table' ? a : null);
    }
    this.validateTotals(a, p, push);
    this.validateLogic(a.logic, `${p}.logic`, push, keys, row);
  }

  private validateTable(t: DfTable, p: string, push: Push, keys: Set<string>, row: RowKeys): void {
    if (typeof t.id !== 'string' || !ID_RE.test(t.id)) push(`${p}.id`, 'Una tabla necesita id con formato ^[A-Za-z][A-Za-z0-9_-]*$');
    const isCount = (n: unknown) => Number.isInteger(n) && (n as number) >= 1;
    if (t.pageSize != null && !isCount(t.pageSize)) push(`${p}.pageSize`, 'pageSize debe ser un entero mayor o igual que 1');
    if (t.pageSizeOptions != null && !(Array.isArray(t.pageSizeOptions) && t.pageSizeOptions.length > 0 && t.pageSizeOptions.every(isCount))) {
      push(`${p}.pageSizeOptions`, 'pageSizeOptions debe ser un array de enteros mayores o igual que 1');
    }
    if (t.searchKeys != null && !(Array.isArray(t.searchKeys) && t.searchKeys.every((k) => typeof k === 'string' && KEY_RE.test(k)))) {
      push(`${p}.searchKeys`, 'searchKeys debe ser un array de claves con formato ^[A-Za-z_][A-Za-z0-9_.]*$');
    }
    if (t.dataKey != null && (typeof t.dataKey !== 'string' || !KEY_RE.test(t.dataKey))) push(`${p}.dataKey`, 'dataKey con formato ^[A-Za-z_][A-Za-z0-9_.]*$');
    if (t.rows != null && !(Array.isArray(t.rows) && t.rows.every((r) => r && typeof r === 'object' && !Array.isArray(r)))) {
      push(`${p}.rows`, 'rows debe ser un array de objetos');
    }

    if (t.source != null) this.validateTableSource(t, p, push, keys, row);
    if (t.selectable != null && typeof t.selectable !== 'boolean' && t.selectable !== 'single' && t.selectable !== 'multiple') {
      push(`${p}.selectable`, "selectable debe ser true, false, 'single' o 'multiple'");
    }
    if (t.pinnableColumns != null && typeof t.pinnableColumns !== 'boolean') push(`${p}.pinnableColumns`, 'pinnableColumns debe ser true o false');
    if (t.resizableColumns != null && typeof t.resizableColumns !== 'boolean') push(`${p}.resizableColumns`, 'resizableColumns debe ser true o false');
    if (t.reorderableColumns != null && typeof t.reorderableColumns !== 'boolean') push(`${p}.reorderableColumns`, 'reorderableColumns debe ser true o false');
    if (t.persistState != null && typeof t.persistState !== 'boolean' && t.persistState !== 'session' && t.persistState !== 'local') {
      push(`${p}.persistState`, "persistState debe ser true, false, 'session' o 'local'");
    }
    if (t.stateKey != null && (typeof t.stateKey !== 'string' || !ID_RE.test(t.stateKey))) {
      push(`${p}.stateKey`, 'stateKey con formato ^[A-Za-z][A-Za-z0-9_-]*$');
    }
    if (t.selectableWhen != null) {
      if (t.selectable == null || t.selectable === false) push(`${p}.selectableWhen`, 'selectableWhen solo tiene sentido con selectable');
      this.validateRule(t.selectableWhen, `${p}.selectableWhen`, push, keys, ANY_ROW_KEY);
    }
    if (t.headerSelects != null) {
      if (t.headerSelects !== 'filtered' && t.headerSelects !== 'page') push(`${p}.headerSelects`, "headerSelects debe ser 'filtered' o 'page'");
      else if (t.selectable !== 'multiple') push(`${p}.headerSelects`, "headerSelects solo tiene sentido con selectable: 'multiple'");
    }
    if (t.selectionKey != null) {
      if (typeof t.selectionKey !== 'string' || !KEY_RE.test(t.selectionKey)) push(`${p}.selectionKey`, 'selectionKey con formato ^[A-Za-z_][A-Za-z0-9_.]*$');
      else if (t.selectable !== 'multiple') push(`${p}.selectionKey`, "selectionKey solo tiene sentido con selectable: 'multiple'");
    }
    if (t.exportCsv != null && typeof t.exportCsv !== 'boolean') {
      const e = t.exportCsv as unknown;
      if (!e || typeof e !== 'object' || Array.isArray(e)) push(`${p}.exportCsv`, 'exportCsv debe ser true, false o un objeto { filename }');
      else {
        const name = (e as { filename?: unknown }).filename;
        if (Object.keys(e).some((k) => k !== 'filename')) push(`${p}.exportCsv`, 'exportCsv solo admite filename');
        if (name != null && (typeof name !== 'string' || name.length > 100 || !FILENAME_RE.test(name))) {
          push(`${p}.exportCsv.filename`, 'filename con formato ^[A-Za-z0-9_][A-Za-z0-9_. -]*$ y hasta 100 caracteres');
        }
      }
    }

    const columnKeys = new Set<string>();
    if (!Array.isArray(t.columns) || t.columns.length === 0) {
      push(`${p}.columns`, 'Una tabla necesita columns');
    } else {
      t.columns.forEach((c, i) => {
        const cp = `${p}.columns[${i}]`;
        if (!c || typeof c !== 'object') return push(cp, 'Columna inválida');
        if (typeof c.key !== 'string' || !KEY_RE.test(c.key)) push(`${cp}.key`, 'key obligatoria con formato ^[A-Za-z_][A-Za-z0-9_.]*$');
        else if (columnKeys.has(c.key)) push(`${cp}.key`, `Columna repetida: ${c.key}`);
        else columnKeys.add(c.key);
        if (typeof c.label !== 'string' || !c.label) push(`${cp}.label`, 'Una columna necesita label');
        if (c.type != null && !DF_TABLE_COLUMN_TYPES.includes(c.type)) push(`${cp}.type`, `Tipo de columna no soportado: ${String(c.type)}`);
        if (c.type === 'map' && (!c.map || typeof c.map !== 'object' || Array.isArray(c.map))) push(`${cp}.map`, 'Una columna map necesita map');
        if (c.type === 'badge' && c.variants != null) {
          const bad = !c.variants || typeof c.variants !== 'object' || Array.isArray(c.variants)
            || Object.values(c.variants).some((x) => !DF_BADGE_VARIANTS.includes(x));
          if (bad) push(`${cp}.variants`, 'variants debe asignar a cada valor ok, warn, error o info');
        } else if (c.type !== 'badge' && c.variants != null) push(`${cp}.variants`, 'variants solo se admite en columnas de tipo badge');
        if (c.template != null && (typeof c.template !== 'string' || !SLOT_NAME_RE.test(c.template))) push(`${cp}.template`, 'template con formato ^[A-Za-z][A-Za-z0-9_-]*$');
        if (c.type === 'link') {
          if (typeof c.href !== 'string' || !HREF_RE.test(c.href)) push(`${cp}.href`, 'Una columna link necesita href que empiece por /, #, http:// o https://');
        } else if (c.href != null) push(`${cp}.href`, 'href solo se admite en columnas de tipo link');
        if (c.col != null && !(Number.isInteger(c.col) && c.col >= 1 && c.col <= 12)) push(`${cp}.col`, 'col entre 1 y 12');
        if (c.filter != null && typeof c.filter !== 'boolean') push(`${cp}.filter`, 'filter debe ser true o false');
        if (c.frozen != null && typeof c.frozen !== 'boolean') push(`${cp}.frozen`, 'frozen debe ser true o false');
        else if (c.frozen === true && t.columns.slice(0, i).some((prev) => prev?.frozen !== true)) {
          push(`${cp}.frozen`, 'Una columna fija no puede ir detrás de una que no lo es: las fijas van primero');
        }
        if (c.html != null && typeof c.html !== 'boolean') push(`${cp}.html`, 'html debe ser true o false');
        else if (c.html === true && c.type != null && c.type !== 'text') push(`${cp}.html`, 'html solo se admite en columnas de tipo text');
        if (c.currency != null && !isCurrencyCode(c.currency)) push(`${cp}.currency`, `Código de moneda ISO 4217 no válido: ${String(c.currency)}`);
      });
    }
    if (t.multiSort != null && typeof t.multiSort !== 'boolean') push(`${p}.multiSort`, 'multiSort debe ser true o false');
    if (t.sort != null) {
      const list = Array.isArray(t.sort) ? t.sort : [t.sort];
      if (list.length > 1 && t.multiSort !== true) push(`${p}.sort`, 'Un orden con varias columnas necesita multiSort: true');
      const seen = new Set<string>();
      list.forEach((s, i) => {
        const sp = Array.isArray(t.sort) ? `${p}.sort[${i}]` : `${p}.sort`;
        if (!s || typeof s !== 'object' || !columnKeys.has(s.key)) push(`${sp}.key`, 'sort.key debe ser la key de una columna');
        else if (seen.has(s.key)) push(`${sp}.key`, `Columna repetida en el orden: ${s.key}`);
        else seen.add(s.key);
        if (s && typeof s === 'object' && s.direction != null && s.direction !== 'asc' && s.direction !== 'desc') push(`${sp}.direction`, "direction debe ser 'asc' o 'desc'");
      });
    }
    if (t.actions != null) {
      if (!Array.isArray(t.actions)) push(`${p}.actions`, 'actions debe ser un array');
      else {
        const names = new Set<string>();
        t.actions.forEach((a, i) => {
          const ap = `${p}.actions[${i}]`;
          if (!a || typeof a.name !== 'string' || !a.name) push(`${ap}.name`, 'name obligatorio');
          else if (names.has(a.name)) push(`${ap}.name`, `Acción repetida: ${a.name}`);
          else names.add(a.name);
          if (!a || typeof a.label !== 'string' || !a.label) push(`${ap}.label`, 'Una acción necesita label');
          if (a?.icon != null && (typeof a.icon !== 'string' || !a.icon || a.icon.length > 32)) push(`${ap}.icon`, 'icon debe ser un texto de hasta 32 caracteres');
          if (a?.tooltip != null && typeof a.tooltip !== 'string') push(`${ap}.tooltip`, 'tooltip debe ser un texto');
          // Las reglas de una acción leen de la fila (`./campo`), cuyas propiedades no se conocen: cualquiera vale.
          for (const k of ['showWhen', 'disabledWhen'] as const) {
            if (a?.[k] != null) this.validateRule(a[k]!, `${ap}.${k}`, push, keys, ANY_ROW_KEY);
          }
        });
      }
    }
    this.validateLogic(t.logic, `${p}.logic`, push, keys, row);
  }

  private validateTableSource(t: DfTable, p: string, push: Push, keys: Set<string>, row: RowKeys): void {
    const src = t.source;
    if (!src || typeof src !== 'object' || Array.isArray(src)) return push(`${p}.source`, 'source debe ser un objeto');
    if (typeof src.endpoint !== 'string' || !src.endpoint) push(`${p}.source.endpoint`, 'source necesita endpoint');
    if (src.mode != null && src.mode !== 'client' && src.mode !== 'server') push(`${p}.source.mode`, "mode debe ser 'client' o 'server'");
    if (src.mode === 'server' && t.pageSize == null) push(`${p}.pageSize`, 'source.mode "server" necesita pageSize');
    if (t.rows != null || t.dataKey != null) push(`${p}.source`, 'source no se combina con rows ni dataKey');
    if (src.dependsOn != null) {
      if (!Array.isArray(src.dependsOn)) push(`${p}.source.dependsOn`, 'dependsOn debe ser un array');
      else if (src.externalParams === true) {
        src.dependsOn.forEach((d) => {
          if (typeof d !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(d)) push(`${p}.source.dependsOn`, `Clave de modelo no válida: ${String(d)}`);
        });
      } else src.dependsOn.forEach((d) => this.checkRef(String(d), `${p}.source.dependsOn`, push, keys, row));
    }
    if (src.externalParams != null && typeof src.externalParams !== 'boolean') push(`${p}.source.externalParams`, 'externalParams debe ser true o false');
    if (src.requireParams != null && typeof src.requireParams !== 'boolean') push(`${p}.source.requireParams`, 'requireParams debe ser true o false');
  }

  private validateTotals(a: DfArray, p: string, push: Push): void {
    if (a.totals == null) return;
    if (!Array.isArray(a.totals)) return push(`${p}.totals`, 'totals debe ser un array');
    const types = new Map<string, string>();
    const collect = (nodes: DfNode[]) =>
      (Array.isArray(nodes) ? nodes : []).forEach((n) => {
        if (!n || typeof n !== 'object') return;
        if (isDfGroup(n)) collect(n.fields);
        else if (isDfField(n) && n.key) types.set(n.key, n.type);
      });
    collect(a.fields);
    a.totals.forEach((t, i) => {
      const tp = `${p}.totals[${i}]`;
      if (!t || typeof t !== 'object') return push(tp, 'Total inválido');
      if (typeof t.label !== 'string' || !t.label) push(`${tp}.label`, 'Un total necesita label');
      if (!DF_ARRAY_TOTAL_OPS.includes(t.op)) return push(`${tp}.op`, `op desconocida: ${String(t.op)}`);
      if (t.field == null) {
        if (t.op !== 'count') push(`${tp}.field`, `El total ${t.op} necesita field`);
      } else if (!types.has(t.field)) {
        push(`${tp}.field`, `Campo desconocido en la fila: ${t.field}`);
      } else if (t.op !== 'count' && !['number', 'currency'].includes(types.get(t.field)!)) {
        push(`${tp}.field`, `El total ${t.op} necesita un campo number o currency`);
      }
    });
  }

  private validateField(f: DfField, p: string, push: Push, keys: Set<string>, row: RowKeys, table: DfArray | null): void {
    if (table && (f.hidden === true || f.logic?.showWhen || f.logic?.hideWhen)) {
      push(`${p}.logic`, 'En una lista con display "table" un campo no puede ocultarse: desalinearía las columnas');
    }
    if (typeof f.key !== 'string' || !KEY_RE.test(f.key)) push(`${p}.key`, 'key obligatoria con formato ^[A-Za-z_][A-Za-z0-9_.]*$');
    else if (isReservedKey(f.key)) push(`${p}.key`, 'La clave ctx está reservada para el contexto externo de las condiciones (ctx.nombre)');
    if (!this.isKnownType(f.type)) push(`${p}.type`, `Tipo no soportado: ${String(f.type)}`);

    if (OPTION_TYPES.has(f.type) && f.options == null) push(`${p}.options`, `El tipo ${f.type} necesita options`);
    if (f.options && !Array.isArray(f.options)) {
      const o = f.options;
      if (o.source === 'static' && !Array.isArray(o.items)) push(`${p}.options.items`, 'static necesita items');
      if (o.source === 'dependent') this.checkRef(o.dependsOn, `${p}.options.dependsOn`, push, keys, row);
      if (o.source === 'dependent' && (!o.map || typeof o.map !== 'object' || Array.isArray(o.map))) push(`${p}.options.map`, 'dependent necesita map');
      if (o.source === 'remote' && (typeof o.endpoint !== 'string' || !o.endpoint)) push(`${p}.options.endpoint`, 'remote necesita endpoint');
      if (o.source === 'remote') (o.dependsOn ?? []).forEach((d) => this.checkRef(d, `${p}.options.dependsOn`, push, keys, row));
      if (!['static', 'dependent', 'remote'].includes(o.source)) push(`${p}.options.source`, `source desconocido: ${String(o.source)}`);
    }

    const v = f.validation;
    if (v) {
      if (v.pattern != null) {
        try { new RegExp(v.pattern); } catch { push(`${p}.validation.pattern`, 'Expresión regular inválida'); }
      }
      [...(v.validators ?? []), ...(v.asyncValidators ?? [])].forEach((ref, i) => {
        if (!ref?.name) push(`${p}.validation.validators[${i}]`, 'name obligatorio');
        else if (!this.registry.has(ref.name)) push(`${p}.validation.validators[${i}]`, `Validador no registrado: ${ref.name}`);
      });
    }

    if (f.layout?.col != null && (f.layout.col < 1 || f.layout.col > 12)) push(`${p}.layout.col`, 'col entre 1 y 12');
    if (f.type === 'currency' && f.props) this.validateCurrencyProps(f.props, `${p}.props`, push);
    this.validateLogic(f.logic, `${p}.logic`, push, keys, row);
  }

  private validateLogic(logic: DfField['logic'], p: string, push: Push, keys: Set<string>, row: RowKeys): void {
    if (!logic) return;
    (['showWhen', 'hideWhen', 'requiredWhen', 'disabledWhen'] as const).forEach((k) => {
      if (logic[k]) this.validateRule(logic[k]!, `${p}.${k}`, push, keys, row);
    });
  }

  /** Comprueba que una referencia a otro campo existe: la raíz, o la fila si empieza por `./`. */
  private checkRef(ref: string, p: string, push: Push, keys: Set<string>, row: RowKeys): void {
    if (ref.startsWith(CONTEXT_PREFIX)) {
      // El contexto lo pasa la app (`<dynamic-form [context]>`): no se puede saber qué claves traerá.
      if (ref.length === CONTEXT_PREFIX.length) push(p, 'ctx. necesita el nombre de una clave del contexto: ctx.modo');
    } else if (ref.startsWith(RELATIVE_PREFIX)) {
      if (!row) push(p, `La ruta relativa ${ref} solo se puede usar dentro de una lista`);
      else if (!row.has(ref.slice(RELATIVE_PREFIX.length))) push(p, `Campo desconocido en la fila: ${ref}`);
    } else if (!keys.has(ref)) {
      push(p, `Campo desconocido: ${ref}`);
    }
  }

  private validateRule(rule: DfRule, p: string, push: Push, keys: Set<string>, row: RowKeys): void {
    if (!rule || typeof rule !== 'object') return push(p, 'Regla inválida');
    const c = rule as DfCondition;
    if (typeof c.field === 'string') {
      this.checkRef(c.field, `${p}.field`, push, keys, row);
      if (!DF_OPERATORS.includes(c.operator)) push(`${p}.operator`, `Operador desconocido: ${String(c.operator)}`);
      else if (!VALUELESS_OPERATORS.has(c.operator) && c.value === undefined) push(`${p}.value`, `value obligatorio con el operador ${c.operator}`);
      return;
    }
    const g = rule as DfRuleGroup;
    if (!g.all && !g.any && !g.not) return push(p, 'Un grupo de reglas necesita all, any o not');
    g.all?.forEach((r, i) => this.validateRule(r, `${p}.all[${i}]`, push, keys, row));
    g.any?.forEach((r, i) => this.validateRule(r, `${p}.any[${i}]`, push, keys, row));
    if (g.not) this.validateRule(g.not, `${p}.not`, push, keys, row);
  }

  /** Props de un campo currency que vienen del backend: si no son válidas, el adaptador las ignoraría. */
  private validateCurrencyProps(props: Record<string, unknown>, p: string, push: (path: string, msg: string) => void): void {
    if (props['currency'] != null && !isCurrencyCode(props['currency'])) push(`${p}.currency`, `Código de moneda ISO 4217 no válido: ${String(props['currency'])}`);
    if (props['numberFormat'] != null && !NUMBER_FORMATS.includes(props['numberFormat'] as never)) push(`${p}.numberFormat`, "numberFormat debe ser 'es' o 'en'");
    if (props['wordsLanguage'] != null && !WORDS_LANGUAGES.includes(props['wordsLanguage'] as never)) push(`${p}.wordsLanguage`, "wordsLanguage debe ser 'es' o 'en'");
    for (const k of ['amountInWords', 'wordsUppercase']) {
      if (props[k] != null && typeof props[k] !== 'boolean') push(`${p}.${k}`, `${k} debe ser true o false`);
    }
    const w = props['currencyWords'] as Record<string, unknown> | undefined;
    if (w != null && (typeof w !== 'object' || !['singular', 'plural', 'centSingular', 'centPlural'].every((k) => typeof w[k] === 'string'))) {
      push(`${p}.currencyWords`, 'currencyWords necesita singular, plural, centSingular y centPlural');
    }
  }

  /** Tipos del contrato o tipos registrados en Formly con provideDynamicForms({ types }). */
  private isKnownType(type: unknown): boolean {
    if (typeof type !== 'string') return false;
    return DF_FIELD_TYPES.includes(type as DfFieldType) || this.declaredTypes.has(type) || !!this.formlyConfig?.types[type];
  }
}
