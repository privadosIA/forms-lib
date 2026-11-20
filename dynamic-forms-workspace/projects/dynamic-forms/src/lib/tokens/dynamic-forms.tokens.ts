import { InjectionToken } from '@angular/core';
import { DfOptionsProvider, DfResolvedConfig, DfTableProvider, DfValidatorDefinition } from '../models/config.model';

export const DYNAMIC_FORMS_CONFIG = new InjectionToken<DfResolvedConfig>('DYNAMIC_FORMS_CONFIG');

/** multi: true — cada provider aporta un array de definiciones. */
export const DF_VALIDATORS = new InjectionToken<DfValidatorDefinition[][]>('DF_VALIDATORS');

export const DF_OPTIONS_PROVIDER = new InjectionToken<DfOptionsProvider>('DF_OPTIONS_PROVIDER');

export const DF_TABLE_PROVIDER = new InjectionToken<DfTableProvider>('DF_TABLE_PROVIDER');
