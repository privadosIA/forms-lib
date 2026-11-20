import { EnvironmentProviders, Provider, Type } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { FormlyFieldConfig, ConfigOption } from '@ngx-formly/core';
import { Observable } from 'rxjs';
import { DfNumberFormat, DfWordsLanguage } from '../utils/currency';
import { DfMaxLengthMode } from '../utils/text-length';
import { DfTableTexts } from '../utils/table-texts';
import { DfFieldType, DfFormSchema, DfOption } from './schema.model';

export type { DfMaxLengthMode } from '../utils/text-length';
export type { DfTableTexts } from '../utils/table-texts';

/** Resultado de un validador: true == válido (semántica de Formly). */
export type DfValidatorResult = boolean | Promise<boolean> | Observable<boolean>;

export type DfValidatorFn = (
  control: AbstractControl,
  args?: Record<string, unknown>,
  field?: FormlyFieldConfig,
) => DfValidatorResult;

export type DfMessageFn = (args: Record<string, unknown> | undefined, field: FormlyFieldConfig) => string;

export interface DfValidatorDefinition {
  name: string;
  async?: boolean;
  validate: DfValidatorFn;
  message: string | DfMessageFn;
}

/** Resolver de options.source === 'remote'. Lo implementa la app consumidora. */
export interface DfOptionsProvider {
  load(endpoint: string, params: Record<string, unknown>): Observable<DfOption[]>;
}

/**
 * Tema visual. Decide qué componente Formly renderiza cada tipo del contrato
 * y qué providers (p. ej. FormlyMaterialModule) hay que registrar.
 */
export interface DfTheme {
  name: string;
  /** tipo del contrato → nombre de tipo Formly */
  typeMap: Partial<Record<DfFieldType, string>>;
  /** wrappers por defecto para cada campo (p. ej. ['df-field']) */
  fieldWrappers?: string[];
  /** wrappers de un tipo concreto del contrato; sustituyen a `fieldWrappers` (p. ej. { checkbox: [] }) */
  typeWrappers?: Partial<Record<DfFieldType, string[]>>;
  /** wrapper para grupos (fieldset) */
  groupWrapper?: string;
  /** providers adicionales (importProvidersFrom(FormlyMaterialModule), etc.) */
  providers?: (Provider | EnvironmentProviders)[];
  /** tipos/wrappers Formly que el propio tema registra */
  formlyConfig?: ConfigOption;
  /** clase CSS añadida al host del formulario */
  hostClass?: string;
  /** props por tipo que el tema necesita (p. ej. multiselect → { multiple: true }) */
  typeProps?: Partial<Record<DfFieldType, Record<string, unknown>>>;
}

export type DfValidationMessage = string | ((error: unknown, field: FormlyFieldConfig) => string);

/**
 * Valores por defecto de los campos type currency. Cada campo puede cambiarlos con sus props
 * (currency, numberFormat, wordsLanguage, amountInWords, wordsUppercase).
 */
export interface DfCurrencyConfig {
  /** Código ISO 4217. Por defecto, EUR. */
  code?: string;
  /** 'es' (1.500,75) o 'en' (1,500.75). Por defecto, 'es'. */
  numberFormat?: DfNumberFormat;
  /** Idioma del importe en letra. Por defecto, el de numberFormat. */
  wordsLanguage?: DfWordsLanguage;
  /** Escribir el importe en letra bajo el campo. Por defecto, true. */
  amountInWords?: boolean;
  /** Letra en mayúsculas. Por defecto, true. */
  wordsUppercase?: boolean;
}

export interface DynamicFormsConfig {
  theme?: DfTheme;
  types?: ConfigOption['types'];
  wrappers?: ConfigOption['wrappers'];
  validators?: DfValidatorDefinition[];
  messages?: Record<string, DfValidationMessage>;
  defaultResetOnHide?: boolean;
  strictSchema?: boolean;
  optionsProvider?: Type<DfOptionsProvider>;
  /** Resolver de `table.source`. */
  tableProvider?: Type<DfTableProvider>;
  /** Cómo cuenta validation.maxLength: 'weighted' (por defecto; ñ, á… cuentan 2) o 'chars'. */
  maxLengthMode?: DfMaxLengthMode;
  /** Moneda y formato por defecto de los campos type currency. */
  currency?: DfCurrencyConfig;
  /** Textos fijos de las tablas ("Buscar", "Filas por página"…); lo que no se indique queda en español. */
  tableTexts?: Partial<DfTableTexts>;
}

export interface DfResolvedConfig {
  theme: DfTheme;
  defaultResetOnHide: boolean;
  strictSchema: boolean;
  maxLengthMode: DfMaxLengthMode;
  currency: Required<DfCurrencyConfig>;
  tableTexts: DfTableTexts;
}

export type DfFormStatus = 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED';

export interface DfSubmitEvent<T = Record<string, unknown>> {
  model: T;
  form: FormGroup;
  schema: DfFormSchema;
}

/** Lo que la tabla pide al servicio. En modo `client` solo importan el endpoint y los `params`. */
export interface DfTableRequest {
  /** Página que se pide, desde 0. Siempre 0 en modo `client`. */
  page: number;
  /** Filas por página; null en modo `client`. */
  pageSize: number | null;
  /** Orden elegido por el usuario (o el inicial del esquema); null en modo `client`. */
  sort: { key: string; direction: 'asc' | 'desc' } | null;
  /**
   * Todo el orden, de la columna principal a la última que desempata (`sort` es la primera, o null). Solo tiene
   * más de una con `multiSort`; `[]` en modo `client`.
   */
  sorts: { key: string; direction: 'asc' | 'desc' }[];
  /** Texto del cuadro de búsqueda; vacío en modo `client`. */
  filter: string;
  /**
   * Filtros por columna que el usuario ha rellenado (`key` de la columna → texto escrito o, en las columnas
   * `map` y `boolean`, el valor elegido: la clave del `map`, o `"true"`/`"false"`). Sin los vacíos; `{}` en modo `client`.
   */
  columnFilters: Record<string, string>;
  /** Valor de los campos de `source.dependsOn` (con su nombre, sin el `./` de las rutas relativas). */
  params: Record<string, unknown>;
}

/** Respuesta paginada del servicio: las filas de la página pedida y el total de filas que cumplen el filtro. */
export interface DfTablePage {
  rows: Record<string, unknown>[];
  total: number;
}

/**
 * Resolver de `table.source`. Lo implementa la app consumidora. Puede devolver un array de filas, o
 * `{ rows, total }`; en modo `server` conviene `{ rows, total }` (con un array, el total son las filas recibidas).
 */
export interface DfTableProvider {
  load(endpoint: string, request: DfTableRequest): Observable<DfTablePage | Record<string, unknown>[]>;
}

/**
 * Un enlace de una columna `link` pulsado con el botón izquierdo (`tableNavigate`). Para navegar dentro de la app sin
 * recargar la página, llama a `originalEvent.preventDefault()` y navega tú (`router.navigateByUrl(href)`); si no lo
 * haces, el navegador sigue el enlace.
 */
export interface DfTableNavigateEvent {
  tableId: string;
  /** `key` de la columna. */
  column: string;
  /** Destino ya resuelto con los valores de la fila. */
  href: string;
  row: Record<string, unknown>;
  originalEvent: MouseEvent;
}

/** Un botón de fila de una tabla pulsado (`tableAction`). */
export interface DfTableActionEvent {
  tableId: string;
  action: string;
  row: Record<string, unknown>;
}

/**
 * Cambio de selección de una tabla (`tableSelect`). `rows` es siempre la selección completa. En una tabla
 * de selección única `row` es la fila elegida (null si se deselecciona); en una `multiple`, `row` es null.
 * `changed` dice qué filas han cambiado con este evento y en qué sentido, en cualquier modo.
 */
export interface DfTableSelectEvent {
  tableId: string;
  row: Record<string, unknown> | null;
  rows: Record<string, unknown>[];
  /**
   * Lo que ha cambiado: `selected: true` son filas que se acaban de marcar (una al pulsar, varias con Mayús+clic o con la
   * casilla de la cabecera) y `selected: false` filas que se acaban de desmarcar (también las que se pierden al recargar
   * la tabla). Con selección única, la fila elegida es la marcada; la que dejó de estarlo no se lista.
   */
  changed: { rows: Record<string, unknown>[]; selected: boolean };
}

export interface DfSchemaIssue {
  path: string;
  message: string;
}

export interface DfSchemaValidationResult {
  valid: boolean;
  errors: DfSchemaIssue[];
}

export class DynamicFormsSchemaError extends Error {
  constructor(public readonly issues: DfSchemaIssue[]) {
    super(`Esquema de formulario inválido:\n${issues.map((i) => ` - ${i.path}: ${i.message}`).join('\n')}`);
    this.name = 'DynamicFormsSchemaError';
  }
}
