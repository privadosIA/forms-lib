import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dependientes' },
  {
    path: 'dependientes',
    title: 'Campos dependientes',
    loadComponent: () => import('./pages/dependent-fields/dependent-fields.component').then((m) => m.DependentFieldsComponent),
  },
  {
    path: 'validacion',
    title: 'Validación de negocio',
    loadComponent: () => import('./pages/business-validation/business-validation.component').then((m) => m.BusinessValidationComponent),
  },
  {
    path: 'remoto',
    title: 'Esquema remoto',
    loadComponent: () => import('./pages/remote-schema/remote-schema.component').then((m) => m.RemoteSchemaComponent),
  },
  {
    path: 'listas',
    title: 'Listas repetibles',
    loadComponent: () => import('./pages/repeatable-lists/repeatable-lists.component').then((m) => m.RepeatableListsComponent),
  },
  {
    path: 'tablas',
    title: 'Tablas de datos',
    loadComponent: () => import('./pages/data-tables/data-tables.component').then((m) => m.DataTablesComponent),
  },
  {
    path: 'editor',
    title: 'Editor en vivo',
    loadComponent: () => import('./pages/schema-editor/schema-editor.component').then((m) => m.SchemaEditorComponent),
  },
];
