import { Injectable, inject } from '@angular/core';
import { AbstractControl, Validators } from '@angular/forms';
import { ConfigOption, FORMLY_CONFIG, FormlyConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { Observable, Subscription, isObservable, of } from 'rxjs';
import { distinctUntilChanged, shareReplay } from 'rxjs/operators';
import {
  DfMessageFn, DfOptionsProvider, DfValidatorDefinition, DynamicFormsSchemaError,
} from '../models/config.model';
import {
  DfArray, DfArrayTotal, DfConditionalLogic, DfField, DfFieldType, DfFormSchema, DfGroup, DfNode, DfOption, DfOptionsSource, DfRule,
  DfSlot, DfTable, DfTableColumn, DfValidation, DfValidatorRef, isDfArray, isDfField, isDfGroup, isDfSlot, isDfTable,
} from '../models/schema.model';
import { DF_OPTIONS_PROVIDER, DYNAMIC_FORMS_CONFIG } from '../tokens/dynamic-forms.tokens';
import { NUMBER_FORMATS, WORDS_LANGUAGES, amountError, isCurrencyCode } from '../utils/currency';
import type { DfNumberFormat, DfWordsLanguage } from '../utils/currency';
import type { DfResolvedTotal } from '../utils/array-totals';
import type { DfResolvedColumn } from '../utils/table';
import { contextOf, paramName, readPath, rootModel } from '../utils/model-path';
import { DfMaxLengthMode, resolveMaxLengthMode, textLength } from '../utils/text-length';
import { ConditionEvaluatorService, RELATIVE_PREFIX, getByPath } from './condition-evaluator.service';
import { SchemaValidatorService } from './schema-validator.service';
import { ValidatorRegistryService } from './validator-registry.service';

type Props = Record<string, unknown>;

const FORBIDDEN_PROP_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PROP_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
// eslint-disable-next-line no-control-regex -- la sanitización elimina justo estos caracteres
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function interpolate(template: string, data: Props): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => {
    const v = getByPath(data, k);
    return v == null ? '' : String(v);
  });
}

/**
 * Adapter Layer: SchemaContract (JSON) → FormlyFieldConfig[].
 * Única pieza de la librería que conoce Formly en profundidad.
 */
@Injectable({ providedIn: 'root' })
export class FormSchemaAdapterService {
  private readonly config = inject(DYNAMIC_FORMS_CONFIG);
  private readonly registry = inject(ValidatorRegistryService);
  private readonly schemaValidator = inject(SchemaValidatorService);
  private readonly evaluator = inject(ConditionEvaluatorService);
  private optionsProvider: DfOptionsProvider | null = inject(DF_OPTIONS_PROVIDER, { optional: true });
  private readonly formlyConfig = inject(FormlyConfig, { optional: true });
  /** Tipos declarados en forRoot(): se leen de FORMLY_CONFIG porque Formly los aplica en diferido. */
  private readonly declaredTypes = ([inject(FORMLY_CONFIG, { optional: true }) ?? []] as unknown[])
    .flat(Infinity)
    .flatMap((c) => (c as ConfigOption | null)?.types ?? []);

  /** `layout.resetOnHide` del esquema que se está traduciendo (toFormly es síncrono). */
  private schemaResetOnHide: boolean | undefined;
  private readonly remoteCache = new Map<string, Observable<DfOption[]>>();
  private readonly subscriptions = new WeakMap<FormlyFieldConfig, Subscription>();

  /**
   * Registra (o sustituye) el proveedor de `options.source = 'remote'` en tiempo de ejecución. Sirve cuando
   * `provideDynamicForms` está en los providers de una ruta y no llega a este servicio (que es `root`), como el
   * `DF_OPTIONS_PROVIDER`. Vacía la caché de opciones: las siguientes cargas ya van al proveedor nuevo.
   */
  registerOptionsProvider(provider: DfOptionsProvider): void {
    this.optionsProvider = provider;
    this.remoteCache.clear();
  }

  /** Valida, sanitiza y transforma. Lanza DynamicFormsSchemaError en modo estricto. */
  toFormly(schema: DfFormSchema): FormlyFieldConfig[] {
    const result = this.schemaValidator.validate(schema);
    if (!result.valid) {
      if (this.config.strictSchema) throw new DynamicFormsSchemaError(result.errors);
      console.warn('[dynamic-forms] Esquema con incidencias:', result.errors);
    }
    const clean = this.sanitize(schema);
    // columns = campos por fila; por defecto, uno por fila (ocupa las 12 columnas de la rejilla).
    const columns = clean.layout?.columns ?? 1;
    this.schemaResetOnHide = typeof clean.layout?.resetOnHide === 'boolean' ? clean.layout.resetOnHide : undefined;
    try {
      return [
        {
          fieldGroupClassName: `df-grid df-grid--${columns}`,
          fieldGroup: clean.fields.map((n) => this.mapNode(n, columns)),
        },
      ];
    } finally {
      this.schemaResetOnHide = undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Sanitización: copia profunda con whitelist de claves.
  // ---------------------------------------------------------------------------
  sanitize(schema: DfFormSchema): DfFormSchema {
    const str = (v: unknown): string | undefined =>
      typeof v === 'string' ? v.replace(CONTROL_CHARS_RE, '').trim() : undefined;

    const sanitizeNode = (node: DfNode): DfNode => {
      if (isDfGroup(node)) {
        const g: DfGroup = {
          type: 'group',
          id: str(node.id) ?? '',
          title: str(node.title),
          description: str(node.description),
          columns: node.columns,
          cssClass: str(node.cssClass),
          logic: node.logic,
          fields: (node.fields ?? []).map(sanitizeNode),
        };
        return g;
      }
      if (isDfSlot(node)) return { type: 'slot', name: str(node.name) ?? '', cssClass: str(node.cssClass), logic: node.logic } as DfSlot;
      if (isDfTable(node)) return this.sanitizeTable(node, str);
      if (isDfArray(node)) {
        const a: DfArray = {
          type: 'array',
          key: node.key,
          title: str(node.title),
          description: str(node.description),
          itemLabel: str(node.itemLabel),
          addLabel: str(node.addLabel),
          removeLabel: str(node.removeLabel),
          minItems: node.minItems,
          maxItems: node.maxItems,
          totals: Array.isArray(node.totals)
            ? node.totals.map((t) => ({ label: str(t.label) ?? '', op: t.op, field: t.field }))
            : undefined,
          display: node.display,
          columns: node.columns,
          cssClass: str(node.cssClass),
          logic: node.logic,
          fields: (node.fields ?? []).map(sanitizeNode),
        };
        return a;
      }
      const f: DfField = {
        key: node.key,
        type: node.type,
        label: str(node.label),
        placeholder: str(node.placeholder),
        description: str(node.description),
        defaultValue: node.defaultValue,
        readonly: node.readonly === true,
        disabled: node.disabled === true,
        hidden: node.hidden === true,
        options: node.options,
        validation: node.validation,
        logic: node.logic,
        layout: node.layout,
        props: this.sanitizeProps(node.props),
      };
      return f;
    };

    return {
      version: '1.0',
      id: schema.id,
      title: str(schema.title),
      description: str(schema.description),
      layout: schema.layout,
      fields: schema.fields.map(sanitizeNode),
      meta: schema.meta,
    };
  }

  private sanitizeTable(node: DfTable, str: (v: unknown) => string | undefined): DfTable {
    const column = (c: DfTableColumn): DfTableColumn => ({
      key: c.key,
      label: str(c.label) ?? '',
      type: c.type,
      map: c.map && typeof c.map === 'object' ? this.cleanValue(c.map) as Record<string, string> : undefined,
      variants: c.variants && typeof c.variants === 'object' ? this.cleanValue(c.variants) as DfTableColumn['variants'] : undefined,
      href: str(c.href),
      template: str(c.template),
      sortable: c.sortable,
      col: c.col,
      currency: c.currency,
      filter: c.filter === true ? true : undefined,
      frozen: c.frozen === true ? true : undefined,
      html: c.html === true ? true : undefined,
    });
    return {
      type: 'table',
      id: str(node.id) ?? '',
      title: str(node.title),
      description: str(node.description),
      columns: (Array.isArray(node.columns) ? node.columns : []).map(column),
      rows: Array.isArray(node.rows) ? (this.cleanValue(node.rows) as Record<string, unknown>[]) : undefined,
      dataKey: node.dataKey,
      source: node.source && typeof node.source === 'object'
        ? {
          endpoint: str(node.source.endpoint) ?? '', mode: node.source.mode, dependsOn: node.source.dependsOn,
          externalParams: node.source.externalParams === true ? true : undefined,
          requireParams: node.source.requireParams === false ? false : undefined,
        }
        : undefined,
      errorMessage: str(node.errorMessage),
      filter: node.filter === true,
      filterLabel: str(node.filterLabel),
      searchKeys: Array.isArray(node.searchKeys) ? node.searchKeys.filter((k): k is string => typeof k === 'string') : undefined,
      pageSize: node.pageSize,
      pageSizeOptions: node.pageSizeOptions,
      sort: Array.isArray(node.sort) ? node.sort.map((s) => ({ key: s.key, direction: s.direction })) : node.sort ? { key: node.sort.key, direction: node.sort.direction } : undefined,
      multiSort: node.multiSort === true ? true : undefined,
      selectable: node.selectable === 'multiple' ? 'multiple' : node.selectable === 'single' ? 'single' : node.selectable === true,
      selectionKey: node.selectionKey,
      selectableWhen: node.selectableWhen,
      headerSelects: node.headerSelects === 'page' ? 'page' : node.headerSelects === 'filtered' ? 'filtered' : undefined,
      exportCsv: node.exportCsv && typeof node.exportCsv === 'object'
        ? { filename: str(node.exportCsv.filename) }
        : node.exportCsv === true,
      pinnableColumns: node.pinnableColumns === true ? true : undefined,
      reorderableColumns: node.reorderableColumns === true ? true : undefined,
      resizableColumns: node.resizableColumns === true ? true : undefined,
      persistState: node.persistState === 'local' || node.persistState === 'session' ? node.persistState : node.persistState === true ? true : undefined,
      stateKey: str(node.stateKey),
      actions: node.actions?.map((a) => ({
        name: a.name, label: str(a.label) ?? '', icon: str(a.icon), tooltip: str(a.tooltip), showWhen: a.showWhen, disabledWhen: a.disabledWhen,
      })),
      emptyMessage: str(node.emptyMessage),
      cssClass: str(node.cssClass),
      logic: node.logic,
    };
  }

  /** Copia profunda de datos del esquema: sin claves peligrosas ni funciones, y sin caracteres de control en los textos. */
  private cleanValue(value: unknown): unknown {
    if (typeof value === 'string') return value.replace(CONTROL_CHARS_RE, '');
    if (Array.isArray(value)) return value.map((v) => this.cleanValue(v));
    if (value && typeof value === 'object') {
      const out: Props = {};
      for (const [k, v] of Object.entries(value)) {
        if (FORBIDDEN_PROP_KEYS.has(k) || typeof v === 'function') continue;
        out[k] = this.cleanValue(v);
      }
      return out;
    }
    return typeof value === 'function' ? undefined : value;
  }

  private sanitizeProps(props?: Props): Props {
    if (!props) return {};
    const out: Props = {};
    for (const [k, v] of Object.entries(props)) {
      // Cualquier clave que empiece por "on" (onClick, onclick…) puede acabar como manejador de eventos.
      if (FORBIDDEN_PROP_KEYS.has(k) || !PROP_KEY_RE.test(k) || /^on/i.test(k)) continue;
      if (typeof v === 'function') continue;
      out[k] = v;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Nodos
  // ---------------------------------------------------------------------------
  private mapNode(node: DfNode, parentColumns: number): FormlyFieldConfig {
    if (isDfGroup(node)) return this.mapGroup(node);
    if (isDfArray(node)) return this.mapArray(node);
    if (isDfTable(node)) return this.mapTable(node);
    if (isDfSlot(node)) return this.mapSlot(node);
    return this.mapField(node, parentColumns);
  }

  /** Lista repetible: un tipo `df-repeat` (FormArray) cuyas filas son un grupo con los campos del nodo. */
  private mapArray(array: DfArray): FormlyFieldConfig {
    const table = array.display === 'table';
    const columns = array.columns ?? 1;
    const min = array.minItems;
    const max = array.maxItems;
    const cells = array.fields.filter((n) => !(isDfField(n) && n.type === 'hidden'));
    const children = array.fields.map((n) => {
      const child = this.mapNode(n, columns);
      if (!table) return child;
      // Cada campo es una celda: la rejilla de la fila la fija la lista, el nombre va en la cabecera.
      child.className = isDfField(n) ? n.layout?.cssClass : undefined;
      const label = child.props?.['label'];
      child.props = { ...child.props, hideLabel: true, attributes: label ? { 'aria-label': String(label) } : undefined };
      return child;
    });

    const config: FormlyFieldConfig = {
      key: array.key,
      type: 'df-repeat',
      className: ['df-col-12', array.cssClass].filter(Boolean).join(' '),
      defaultValue: min ? Array.from({ length: min }, () => ({})) : undefined,
      props: {
        label: array.title,
        description: array.description,
        itemLabel: array.itemLabel,
        addLabel: array.addLabel,
        removeLabel: array.removeLabel,
        minItems: min,
        maxItems: max,
        display: table ? 'table' : 'rows',
        tableColumns: table ? cells.map((n) => this.tableColumn(n)) : undefined,
        totals: array.totals?.length ? array.totals.map((t) => this.resolveTotal(t, array.fields)) : undefined,
      },
      fieldArray: {
        fieldGroupClassName: table ? 'df-table-row' : `df-grid df-grid--${columns}`,
        fieldGroup: children,
      },
      validators: this.arrayValidators(min, max),
    };
    this.applyLogic(config, array.logic);
    return config;
  }

  /** Hueco para una plantilla de la app: un campo sin key (no crea control) del tipo `df-slot`. */
  private mapSlot(slot: DfSlot): FormlyFieldConfig {
    const config: FormlyFieldConfig = {
      type: 'df-slot',
      className: ['df-col-12', slot.cssClass].filter(Boolean).join(' '),
      props: { slotName: slot.name },
    };
    this.applyLogic(config, slot.logic);
    return config;
  }

  /** Tabla de datos de solo lectura: un campo sin key (no crea control) del tipo `df-table`. */
  private mapTable(table: DfTable): FormlyFieldConfig {
    const columns: DfResolvedColumn[] = table.columns.map((c) => {
      const p = this.currencyProps({ currency: c.currency });
      return {
        key: c.key,
        label: c.label,
        type: c.type ?? 'text',
        map: c.map,
        variants: c.variants,
        href: c.href,
        template: c.template,
        sortable: c.sortable !== false,
        col: Math.min(12, Math.max(1, c.col ?? 1)),
        currency: p['currency'] as string,
        numberFormat: p['numberFormat'] as DfNumberFormat,
        filter: c.filter === true,
        frozen: c.frozen === true,
        html: c.html === true,
      };
    });
    const exportCsv = table.exportCsv
      ? { filename: (typeof table.exportCsv === 'object' ? table.exportCsv.filename : undefined) || table.id }
      : undefined;
    const config: FormlyFieldConfig = {
      type: 'df-table',
      className: ['df-col-12', table.cssClass].filter(Boolean).join(' '),
      props: {
        tableId: table.id,
        title: table.title,
        description: table.description,
        columns,
        staticRows: table.rows,
        dataKey: table.dataKey,
        source: table.source
          ? { endpoint: table.source.endpoint, mode: table.source.mode ?? 'client', dependsOn: table.source.dependsOn ?? [], ...(table.source.requireParams === false ? { requireParams: false } : {}) }
          : undefined,
        errorMessage: table.errorMessage,
        filter: table.filter === true,
        filterLabel: table.filterLabel,
        searchKeys: table.searchKeys,
        pageSize: table.pageSize,
        pageSizeOptions: table.pageSizeOptions,
        sorts: (Array.isArray(table.sort) ? table.sort : table.sort ? [table.sort] : []).map((s) => ({ key: s.key, direction: s.direction ?? 'asc' })),
        multiSort: table.multiSort === true,
        selectable: table.selectable === 'multiple' ? 'multiple' : table.selectable === true || table.selectable === 'single',
        selectionKey: table.selectionKey,
        selectableWhen: table.selectableWhen,
        headerSelects: table.headerSelects === 'page' ? 'page' : 'filtered',
        exportCsv,
        pinnableColumns: table.pinnableColumns === true,
        reorderableColumns: table.reorderableColumns === true,
        resizableColumns: table.resizableColumns === true,
        persistState: table.persistState === 'local' ? 'local' : table.persistState === true || table.persistState === 'session' ? 'session' : undefined,
        stateKey: table.stateKey || table.id,
        actions: table.actions ?? [],
        emptyMessage: table.emptyMessage,
      },
    };
    this.applyLogic(config, table.logic);
    return config;
  }

  /** Resuelve la moneda y el formato de un total con los del campo que suma (o con los de la app). */
  private resolveTotal(total: DfArrayTotal, rowNodes: DfNode[]): DfResolvedTotal {
    const source = total.field ? this.findRowField(rowNodes, total.field) : undefined;
    const base = { label: total.label, op: total.op, field: total.field };
    if (source?.type === 'currency') {
      const p = this.currencyProps(source.props ?? {});
      return { ...base, currency: p['currency'] as string, numberFormat: p['numberFormat'] as DfNumberFormat };
    }
    return { ...base, numberFormat: this.config.currency.numberFormat };
  }

  private findRowField(nodes: DfNode[], key: string): DfField | undefined {
    for (const n of nodes) {
      if (isDfGroup(n)) {
        const found = this.findRowField(n.fields, key);
        if (found) return found;
      } else if (isDfField(n) && n.key === key) {
        return n;
      }
    }
    return undefined;
  }

  private tableColumn(node: DfNode): { label: string; col: number; required: boolean } {
    const field = isDfField(node) ? node : undefined;
    return {
      label: field?.label ?? '',
      col: Math.min(12, Math.max(1, field?.layout?.col ?? 1)),
      required: field?.validation?.required === true,
    };
  }

  private arrayValidators(min: number | undefined, max: number | undefined): FormlyFieldConfig['validators'] {
    const count = (c: AbstractControl) => (Array.isArray(c.value) ? c.value.length : 0);
    return {
      ...(min ? { minItems: { expression: (c: AbstractControl) => count(c) >= min } } : {}),
      ...(max ? { maxItems: { expression: (c: AbstractControl) => count(c) <= max } } : {}),
    };
  }

  private mapGroup(group: DfGroup): FormlyFieldConfig {
    const columns = group.columns ?? 1;
    const theme = this.config.theme;
    const config: FormlyFieldConfig = {
      fieldGroupClassName: `df-grid df-grid--${columns}`,
      // Un grupo (fieldset) ocupa siempre la fila entera de la rejilla que lo contiene.
      className: ['df-col-12', group.cssClass].filter(Boolean).join(' '),
      wrappers: theme.groupWrapper ? [theme.groupWrapper] : [],
      props: { title: group.title, description: group.description, groupId: group.id, cssClass: group.cssClass },
      fieldGroup: group.fields.map((n) => this.mapNode(n, columns)),
    };
    this.applyLogic(config, group.logic);
    return config;
  }

  /**
   * Wrappers de un campo. Manda, por este orden: `theme.typeWrappers` del tipo del contrato (el tema decide, aunque
   * el paquete UI declare wrappers en sus tipos), los `wrappers` del tipo Formly registrado (un tipo propio con
   * `wrappers: []` se pinta sin el wrapper del tema) y `theme.fieldWrappers`.
   */
  private fieldWrappers(contractType: DfFieldType, formlyType: string): string[] {
    const theme = this.config.theme;
    const declared = this.declaredTypes.find((t) => t.name === formlyType)?.wrappers ?? this.formlyConfig?.types[formlyType]?.wrappers;
    return [...(theme.typeWrappers?.[contractType] ?? declared ?? theme.fieldWrappers ?? [])];
  }

  private mapField(field: DfField, parentColumns: number): FormlyFieldConfig {
    const theme = this.config.theme;
    // Un tipo propio (registrado con provideDynamicForms({ types })) no está en typeMap y se usa tal cual.
    const contractType = field.type as DfFieldType;
    const formlyType = theme.typeMap[contractType] ?? field.type;
    const v = field.validation ?? {};

    const props: Props = {
      label: field.label,
      placeholder: field.placeholder,
      description: field.description,
      readonly: field.readonly,
      disabled: field.disabled,
      required: v.required === true,
      min: v.min,
      max: v.max,
      minLength: v.minLength,
      maxLength: v.maxLength,
      pattern: v.pattern,
      ...this.inputTypeProps(field),
      ...(theme.typeProps?.[contractType] ?? {}),
      ...field.props,
    };
    // Los componentes (contador, bloqueo) leen el modo resuelto de las props.
    props['maxLengthMode'] = resolveMaxLengthMode(field.props?.['maxLengthMode'], this.config.maxLengthMode);
    if (field.type === 'currency') Object.assign(props, this.currencyProps(field.props ?? {}));

    const config: FormlyFieldConfig = {
      key: field.key,
      type: formlyType,
      defaultValue: field.defaultValue,
      wrappers: field.type === 'hidden' ? [] : this.fieldWrappers(contractType, formlyType),
      className: field.type === 'hidden' ? 'df-hidden-slot' : this.className(field, parentColumns),
      props,
      hide: field.hidden === true,
      validators: this.fieldValidators(field, v, props),
      asyncValidators: this.mapValidators(v.asyncValidators, true),
      validation: v.messages ? { messages: this.mapMessages(v) } : undefined,
    };

    this.applyOptions(config, field.options);
    this.applyLogic(config, field.logic);
    return config;
  }

  private inputTypeProps(field: DfField): Props {
    switch (field.type) {
      case 'email': return { type: 'email' };
      case 'password': return { type: 'password' };
      case 'number': return { type: 'number' };
      case 'date': return { type: 'date' };
      case 'multiselect': return { multiple: true };
      case 'checkbox': return { hideLabel: true };
      default: return {};
    }
  }

  private className(field: DfField, parentColumns: number): string {
    const span = field.layout?.col ?? Math.max(1, Math.round(12 / parentColumns));
    const classes = [`df-col-${Math.min(12, Math.max(1, span))}`];
    if (field.layout?.order != null) classes.push(`df-order-${field.layout.order}`);
    if (field.layout?.cssClass) classes.push(field.layout.cssClass);
    return classes.join(' ');
  }

  // ---------------------------------------------------------------------------
  // Validadores por alias
  // ---------------------------------------------------------------------------
  /** Validadores síncronos: los alias del esquema más los built-in de los tipos email y currency. */
  private fieldValidators(field: DfField, v: DfValidation, props: Props): FormlyFieldConfig['validators'] {
    const maxLengthMode = props['maxLengthMode'] as DfMaxLengthMode;
    const aliases = this.withWeightedMaxLength(this.mapValidators(v.validators, false), v.maxLength, maxLengthMode);
    if (field.type === 'email') {
      return { email: { expression: (c: AbstractControl) => Validators.email(c) === null }, ...aliases };
    }
    if (field.type === 'currency') {
      const format = props['numberFormat'] as DfNumberFormat;
      const currency = props['currency'] as string;
      return {
        currencyFormat: { expression: (c: AbstractControl) => amountError(c.value, format, currency) !== 'format' },
        currencyDecimals: { expression: (c: AbstractControl) => amountError(c.value, format, currency) !== 'decimals' },
        ...aliases,
      };
    }
    return aliases;
  }

  /**
   * Moneda y formato de un campo currency: lo que diga el campo (si es válido) o la config de la app.
   * El idioma de la letra sigue al numberFormat del campo si el campo lo cambia y no fija wordsLanguage.
   */
  private currencyProps(own: Props): Props {
    const defaults = this.config.currency;
    const pick = <T>(value: unknown, valid: readonly T[]): T | undefined => (valid.includes(value as T) ? (value as T) : undefined);
    const numberFormat = pick<DfNumberFormat>(own['numberFormat'], NUMBER_FORMATS);
    return {
      currency: isCurrencyCode(own['currency']) ? own['currency'] : defaults.code,
      numberFormat: numberFormat ?? defaults.numberFormat,
      wordsLanguage: pick<DfWordsLanguage>(own['wordsLanguage'], WORDS_LANGUAGES) ?? numberFormat ?? defaults.wordsLanguage,
      amountInWords: typeof own['amountInWords'] === 'boolean' ? own['amountInWords'] : defaults.amountInWords,
      wordsUppercase: typeof own['wordsUppercase'] === 'boolean' ? own['wordsUppercase'] : defaults.wordsUppercase,
    };
  }

  /**
   * Formly valida props.maxLength contando caracteres. En modo 'weighted' (ñ, á… cuentan 2) se añade
   * un validador con el mismo error { maxLength: { requiredLength, actualLength } }, así que el
   * mensaje built-in sigue funcionando. Como la longitud con peso nunca es menor, no se contradicen.
   */
  private withWeightedMaxLength(
    validators: FormlyFieldConfig['validators'], max: number | undefined, mode: DfMaxLengthMode,
  ): FormlyFieldConfig['validators'] {
    if (max == null || mode !== 'weighted') return validators;
    const weighted = (c: AbstractControl) => {
      if (typeof c.value !== 'string') return null;
      const actualLength = textLength(c.value, 'weighted');
      return actualLength > max ? { maxLength: { requiredLength: max, actualLength } } : null;
    };
    return { ...(validators ?? {}), validation: [weighted] };
  }

  /** Mensajes por campo: resuelve {{x}} contra las props del campo y los args del validador del mismo nombre. */
  private mapMessages(v: DfValidation): Record<string, (error: unknown, field: FormlyFieldConfig) => string> {
    const refs = [...(v.validators ?? []), ...(v.asyncValidators ?? [])];
    const out: Record<string, (error: unknown, field: FormlyFieldConfig) => string> = {};
    for (const [name, template] of Object.entries(v.messages ?? {})) {
      const args = refs.find((r) => r.name === name)?.args ?? {};
      out[name] = (_error, field) => interpolate(template, { ...(field.props ?? {}), ...args });
    }
    return out;
  }

  private mapValidators(refs: DfValidatorRef[] | undefined, async: boolean): FormlyFieldConfig['validators'] {
    if (!refs?.length) return undefined;
    const out: Record<string, unknown> = {};
    for (const ref of refs) {
      const def = this.registry.get(ref.name);
      if (!def) continue;
      if (!!def.async !== async) {
        console.warn(`[dynamic-forms] "${ref.name}" es ${def.async ? 'async' : 'sync'}; muévelo a ${def.async ? 'asyncValidators' : 'validators'}.`);
        continue;
      }
      out[ref.name] = {
        expression: (control: Parameters<DfValidatorDefinition['validate']>[0], field: FormlyFieldConfig) =>
          def.validate(control, ref.args, field),
        message: this.resolveMessage(ref, def),
      };
    }
    return out as FormlyFieldConfig['validators'];
  }

  private resolveMessage(ref: DfValidatorRef, def: DfValidatorDefinition): (error: unknown, field: FormlyFieldConfig) => string {
    return (_error, field) => {
      const data: Props = { ...(field.props ?? {}), ...(ref.args ?? {}) };
      if (ref.message) return interpolate(ref.message, data);
      if (typeof def.message === 'function') return (def.message as DfMessageFn)(ref.args, field);
      return interpolate(def.message, data);
    };
  }

  // ---------------------------------------------------------------------------
  // Opciones: static | dependent | remote
  // ---------------------------------------------------------------------------
  private applyOptions(config: FormlyFieldConfig, source: DfOptionsSource | undefined): void {
    if (!source) return;
    const props = (config.props ??= {});

    if (Array.isArray(source)) { props['options'] = source; return; }
    if (source.source === 'static') { props['options'] = source.items; return; }

    config.expressions ??= {};
    const deps = source.source === 'dependent' ? [source.dependsOn] : source.dependsOn ?? [];
    const resetOnChange = source.resetOnChange !== false;

    if (source.source === 'dependent') {
      const mapping = source.map ?? {};
      const parent = source.dependsOn;
      props['options'] = [];
      config.expressions['props.options'] = (f: FormlyFieldConfig) => {
        const parentValue = readPath(f, parent);
        return parentValue == null ? [] : mapping[String(parentValue)] ?? [];
      };
    } else {
      const endpoint = source.endpoint;
      props['options'] = [];
      config.expressions['props.options'] = (f: FormlyFieldConfig) => this.remoteOptions(endpoint, deps, f);
    }

    if (resetOnChange && deps.length) this.resetOnParentChange(config, deps);
  }

  private remoteOptions(endpoint: string, deps: string[], field: FormlyFieldConfig): Observable<DfOption[]> {
    if (!endpoint) return of([]);
    if (!this.optionsProvider) {
      console.warn(`[dynamic-forms] options.source="remote" (${endpoint}) sin DF_OPTIONS_PROVIDER registrado.`);
      return of([]);
    }
    // El proveedor recibe el nombre del campo sin el "./" de las rutas relativas.
    const params: Props = {};
    for (const d of deps) params[paramName(d)] = readPath(field, d);
    if (Object.values(params).some((v) => v == null || v === '')) return of([]);
    const cacheKey = `${endpoint}::${JSON.stringify(params)}`;
    let obs = this.remoteCache.get(cacheKey);
    if (!obs) {
      obs = this.optionsProvider.load(endpoint, params).pipe(shareReplay(1));
      this.remoteCache.set(cacheKey, obs);
    }
    return obs;
  }

  /** Cascading: cuando cambia cualquier padre, el hijo se vacía. */
  private resetOnParentChange(config: FormlyFieldConfig, deps: string[]): void {
    const hooks = (config.hooks ??= {});
    const prevInit = hooks.onInit;
    const prevDestroy = hooks.onDestroy;

    hooks.onInit = (f) => {
      prevInit?.(f);
      const root = f.formControl?.root;
      if (!root) return;
      const sub = new Subscription();
      for (const dep of deps) {
        // Una ruta relativa se busca desde la fila (el padre del control); el resto, desde la raíz.
        const relative = dep.startsWith(RELATIVE_PREFIX);
        const parentControl = relative
          ? f.formControl.parent?.get(dep.slice(RELATIVE_PREFIX.length).split('.'))
          : root.get(dep.split('.'));
        if (!parentControl) continue;
        sub.add(
          parentControl.valueChanges
            .pipe(distinctUntilChanged())
            .subscribe(() => {
              if (f.formControl?.value != null && f.formControl.value !== '') f.formControl.setValue(null);
            }),
        );
      }
      this.subscriptions.set(f, sub);
    };
    hooks.onDestroy = (f) => {
      this.subscriptions.get(f)?.unsubscribe();
      this.subscriptions.delete(f);
      prevDestroy?.(f);
    };
  }

  // ---------------------------------------------------------------------------
  // Lógica condicional
  // ---------------------------------------------------------------------------
  private applyLogic(config: FormlyFieldConfig, logic: DfConditionalLogic | undefined): void {
    config.resetOnHide = logic?.resetOnHide ?? this.schemaResetOnHide ?? this.config.defaultResetOnHide;
    if (!logic) return;
    const expressions = (config.expressions ??= {});
    // `f.model` es el objeto que contiene al campo: dentro de una lista repetible, su fila (para `./campo`).
    const rule = (r: DfRule | undefined) => (f: FormlyFieldConfig) => this.evaluator.evaluate(r, rootModel(f), f.model, contextOf(f));

    if (logic.hideWhen || logic.showWhen) {
      const hide = rule(logic.hideWhen);
      const show = rule(logic.showWhen);
      const staticHide = config.hide === true;
      expressions['hide'] = (f: FormlyFieldConfig) => {
        if (staticHide) return true;
        if (logic.hideWhen && hide(f)) return true;
        if (logic.showWhen) return !show(f);
        return false;
      };
    }
    if (logic.requiredWhen) {
      const baseRequired = config.props?.['required'] === true;
      const req = rule(logic.requiredWhen);
      expressions['props.required'] = (f: FormlyFieldConfig) => baseRequired || req(f);
    }
    if (logic.disabledWhen) {
      const baseDisabled = config.props?.['disabled'] === true;
      const dis = rule(logic.disabledWhen);
      expressions['props.disabled'] = (f: FormlyFieldConfig) => baseDisabled || dis(f);
    }
  }
}

/** Helper exportado para tests/consumidores: ¿un valor de expresión es observable? */
export const isObservableOptions = (v: unknown): v is Observable<DfOption[]> => isObservable(v);
export type { DfValidation };
