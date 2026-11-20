import { EnvironmentProviders, importProvidersFrom, makeEnvironmentProviders } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DfCurrencyConfig, DfResolvedConfig, DynamicFormsConfig } from '../models/config.model';
import { PLAIN_THEME } from '../themes/plain.theme';
import { DF_OPTIONS_PROVIDER, DF_TABLE_PROVIDER, DF_VALIDATORS, DYNAMIC_FORMS_CONFIG } from '../tokens/dynamic-forms.tokens';
import { NUMBER_FORMATS, WORDS_LANGUAGES, isCurrencyCode } from '../utils/currency';
import { DEFAULT_TABLE_TEXTS } from '../utils/table-texts';
import { BUSINESS_VALIDATORS } from '../validators/business-validators';
import { DEFAULT_VALIDATION_MESSAGES, toFormlyMessages } from './validation-messages';

/**
 * Inicializa @core/dynamic-forms en la app consumidora.
 *
 *   bootstrapApplication(App, { providers: [provideDynamicForms()] });
 *   bootstrapApplication(App, { providers: [provideDynamicForms({ theme: materialTheme([...]) })] });
 */
export function provideDynamicForms(config: DynamicFormsConfig = {}): EnvironmentProviders {
  const theme = config.theme ?? PLAIN_THEME;
  const resolved: DfResolvedConfig = {
    theme,
    defaultResetOnHide: config.defaultResetOnHide ?? true,
    strictSchema: config.strictSchema ?? true,
    maxLengthMode: config.maxLengthMode ?? 'weighted',
    currency: resolveCurrency(config.currency),
    tableTexts: { ...DEFAULT_TABLE_TEXTS, ...config.tableTexts },
  };

  return makeEnvironmentProviders([
    { provide: DYNAMIC_FORMS_CONFIG, useValue: resolved },
    { provide: DF_VALIDATORS, useValue: BUSINESS_VALIDATORS, multi: true },
    { provide: DF_VALIDATORS, useValue: config.validators ?? [], multi: true },
    ...(config.tableProvider ? [{ provide: DF_TABLE_PROVIDER, useClass: config.tableProvider }] : []),
    ...(config.optionsProvider ? [{ provide: DF_OPTIONS_PROVIDER, useClass: config.optionsProvider }] : []),
    ...(theme.providers ?? []),
    importProvidersFrom(
      FormlyModule.forRoot({
        types: [...(theme.formlyConfig?.types ?? []), ...(config.types ?? [])],
        wrappers: [...(theme.formlyConfig?.wrappers ?? []), ...(config.wrappers ?? [])],
        validationMessages: toFormlyMessages({ ...DEFAULT_VALIDATION_MESSAGES, ...(config.messages ?? {}) }),
        extras: { lazyRender: true, resetFieldOnHide: resolved.defaultResetOnHide, checkExpressionOn: 'modelChange' },
      }),
    ),
  ]);
}

/** Completa la config de moneda y falla al arrancar si un valor no es válido (mejor que dentro de Intl). */
function resolveCurrency(currency: DfCurrencyConfig = {}): Required<DfCurrencyConfig> {
  const numberFormat = currency.numberFormat ?? 'es';
  const resolved: Required<DfCurrencyConfig> = {
    code: currency.code ?? 'EUR',
    numberFormat,
    wordsLanguage: currency.wordsLanguage ?? numberFormat,
    amountInWords: currency.amountInWords ?? true,
    wordsUppercase: currency.wordsUppercase ?? true,
  };
  if (!isCurrencyCode(resolved.code)) {
    throw new Error(`[dynamic-forms] currency.code debe ser un código ISO 4217 (EUR, GBP…): ${String(resolved.code)}`);
  }
  if (!NUMBER_FORMATS.includes(resolved.numberFormat)) {
    throw new Error(`[dynamic-forms] currency.numberFormat debe ser 'es' o 'en': ${String(resolved.numberFormat)}`);
  }
  if (!WORDS_LANGUAGES.includes(resolved.wordsLanguage)) {
    throw new Error(`[dynamic-forms] currency.wordsLanguage debe ser 'es' o 'en': ${String(resolved.wordsLanguage)}`);
  }
  return resolved;
}
