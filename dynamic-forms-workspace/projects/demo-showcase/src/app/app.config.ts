import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { PLAIN_THEME, provideDynamicForms } from '@core/dynamic-forms';
import { routes } from './app.routes';
import { mockBackendInterceptor } from './shared/mock-backend/mock-backend.interceptor';
import { DemoOptionsProvider } from './shared/schema-loader/demo-options.provider';
import { DemoTableProvider } from './shared/schema-loader/demo-table.provider';
import { DEMO_VALIDATORS } from './shared/validators/demo-validators';

/*
 * Para usar Material en lugar del tema plain:
 *
 *   import { importProvidersFrom } from '@angular/core';
 *   import { FormlyMaterialModule } from '@ngx-formly/material';
 *   import { MatNativeDateModule } from '@angular/material/core';
 *   import { materialTheme } from '@core/dynamic-forms';
 *   theme: materialTheme([importProvidersFrom(FormlyMaterialModule, MatNativeDateModule)])
 *   y en styles.scss: @use '@core/dynamic-forms/styles/material';
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([mockBackendInterceptor])),
    provideDynamicForms({
      theme: PLAIN_THEME,
      validators: DEMO_VALIDATORS,
      optionsProvider: DemoOptionsProvider,
      tableProvider: DemoTableProvider,
      defaultResetOnHide: true,
      strictSchema: true,
    }),
  ],
};
