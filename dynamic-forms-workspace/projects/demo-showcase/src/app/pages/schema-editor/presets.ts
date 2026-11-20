import { DfFormSchema } from '@core/dynamic-forms';

/** Esquemas de partida del editor. Los de las otras páginas se cargan de public/schemas. */
export interface EditorPreset {
  id: string;
  label: string;
  /** Nombre del JSON en public/schemas, o el esquema en línea. */
  file?: string;
  schema?: DfFormSchema;
}

const CATALOGO: DfFormSchema = {
  version: '1.0',
  id: 'catalogo',
  title: 'Catálogo de tipos',
  description: 'Un campo de cada tipo del contrato. Cámbialos desde la pestaña Campos o desde el JSON.',
  fields: [
    {
      type: 'group', id: 'textos', title: 'Textos', columns: 2,
      fields: [
        { key: 'nombre', type: 'text', label: 'Texto', placeholder: 'Tu nombre', validation: { required: true, maxLength: 40 } },
        { key: 'correo', type: 'email', label: 'Email', placeholder: 'ana@ejemplo.es' },
        { key: 'clave', type: 'password', label: 'Contraseña', validation: { minLength: 8 } },
        { key: 'edad', type: 'number', label: 'Número', validation: { min: 0, max: 120 } },
        { key: 'comentario', type: 'textarea', label: 'Área de texto', layout: { col: 12 }, validation: { maxLength: 120 } },
      ],
    },
    {
      type: 'group', id: 'opciones', title: 'Opciones', columns: 2,
      fields: [
        { key: 'pais', type: 'select', label: 'Desplegable', options: [{ value: 'es', label: 'España' }, { value: 'uk', label: 'Reino Unido' }] },
        { key: 'idiomas', type: 'multiselect', label: 'Desplegable múltiple', options: [{ value: 'es', label: 'Español' }, { value: 'en', label: 'Inglés' }, { value: 'gl', label: 'Gallego' }] },
        { key: 'turno', type: 'radio', label: 'Opciones (radio)', options: [{ value: 'm', label: 'Mañana' }, { value: 't', label: 'Tarde' }] },
        { key: 'fecha', type: 'date', label: 'Fecha' },
        { key: 'acepto', type: 'checkbox', label: 'Casilla', layout: { col: 12 } },
      ],
    },
    {
      type: 'group', id: 'importes', title: 'Importes', columns: 2,
      fields: [
        { key: 'importe', type: 'currency', label: 'Euros (formato español)', validation: { max: 100000 } },
        { key: 'amount', type: 'currency', label: 'Libras (formato inglés)', props: { currency: 'GBP', numberFormat: 'en' } },
      ],
    },
    { key: 'expediente', type: 'hidden', defaultValue: 'EXP-0001' },
  ],
};

const EN_BLANCO: DfFormSchema = {
  version: '1.0',
  id: 'nuevo',
  title: 'Formulario nuevo',
  fields: [{ key: 'nombre', type: 'text', label: 'Nombre' }],
};

export const EDITOR_PRESETS: EditorPreset[] = [
  { id: 'catalogo', label: 'Catálogo de tipos', schema: CATALOGO },
  { id: 'dependientes', label: 'Campos dependientes', file: 'solicitud-dependiente' },
  { id: 'validacion', label: 'Validación de negocio', file: 'validacion-negocio' },
  { id: 'listas', label: 'Listas repetibles', file: 'listas-repetibles' },
  { id: 'tablas', label: 'Tablas de datos', file: 'tablas-datos' },
  { id: 'blanco', label: 'En blanco', schema: EN_BLANCO },
];
