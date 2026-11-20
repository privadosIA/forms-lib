import { DfFormSchema } from '@core/dynamic-forms';

/** "Base de datos" del backend simulado: formularios que el servidor entrega por id. */
export const MOCK_FORMS: Record<string, DfFormSchema> = {
  'alta-cliente': {
    version: '1.0',
    id: 'altaCliente',
    title: 'Alta de cliente',
    description: 'Formulario servido por GET /api/forms/alta-cliente (backend simulado).',
    layout: { columns: 12 },
    fields: [
      {
        type: 'group',
        id: 'datos',
        title: 'Datos del cliente',
        columns: 2,
        fields: [
          { key: 'nombre', type: 'text', label: 'Nombre', validation: { required: true, minLength: 2 } },
          { key: 'email', type: 'email', label: 'Correo electrónico', validation: { required: true } },
          {
            key: 'tipo',
            type: 'select',
            label: 'Tipo de cliente',
            options: [
              { value: 'particular', label: 'Particular' },
              { value: 'empresa', label: 'Empresa' },
            ],
            validation: { required: true },
          },
          {
            key: 'cif',
            type: 'text',
            label: 'CIF',
            validation: { validators: [{ name: 'cif' }] },
            logic: {
              showWhen: { field: 'tipo', operator: 'eq', value: 'empresa' },
              requiredWhen: { field: 'tipo', operator: 'eq', value: 'empresa' },
            },
          },
          { key: 'iban', type: 'text', label: 'IBAN', validation: { validators: [{ name: 'iban' }] } },
        ],
      },
    ],
  },
  'encuesta-satisfaccion': {
    version: '1.0',
    id: 'encuestaSatisfaccion',
    title: 'Encuesta de satisfacción',
    description: 'Otro formulario del mismo servicio: cambia el id y cambia el formulario, sin tocar el código.',
    fields: [
      {
        key: 'valoracion',
        type: 'radio',
        label: '¿Cómo valoras el servicio?',
        options: [
          { value: 'bien', label: 'Bien' },
          { value: 'regular', label: 'Regular' },
          { value: 'mal', label: 'Mal' },
        ],
        validation: { required: true },
      },
      {
        key: 'motivo',
        type: 'textarea',
        label: '¿Qué podemos mejorar?',
        validation: { maxLength: 300 },
        logic: { showWhen: { field: 'valoracion', operator: 'in', value: ['regular', 'mal'] } },
      },
      { key: 'contacto', type: 'checkbox', label: 'Quiero que me contacten' },
    ],
  },
};
