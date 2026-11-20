/*
 * @core/dynamic-forms — API pública (ver openspec.yaml → ComponentAPI)
 */

// Modelos / contratos
export * from './lib/models/schema.model';
export * from './lib/models/config.model';

// Tokens
export * from './lib/tokens/dynamic-forms.tokens';

// Providers
export * from './lib/providers/provide-dynamic-forms';
export * from './lib/providers/validation-messages';

// Temas
export * from './lib/themes';

// Servicios
export * from './lib/services/form-schema-adapter.service';
export * from './lib/services/schema-validator.service';
export * from './lib/services/validator-registry.service';
export * from './lib/services/condition-evaluator.service';

// Validadores de negocio (funciones puras + catálogo)
export * from './lib/validators/business-validators';

// Importes: parseo en formato español, formato de moneda e importe en letra
export * from './lib/utils/currency';

// Longitud de texto para maxLength (ñ y acentos cuentan 2 en modo 'weighted')
export { textLength, truncateToLength } from './lib/utils/text-length';

// Textos fijos de las tablas: tipo y juego en inglés
export { EN_TABLE_TEXTS } from './lib/utils/table-texts';

// Plantillas de la app para las tablas
export * from './lib/directives/table-slots';
export * from './lib/directives/slot.directive';

// Componentes
export * from './lib/dynamic-form/dynamic-form.component';
export * from './lib/types';
export * from './lib/wrappers';
