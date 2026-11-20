import { bootstrapTheme, materialTheme } from './ui-themes';

describe('temas de paquetes UI', () => {
  it('materialTheme pinta checkbox y radio con el wrapper de la librería, no con mat-form-field', () => {
    const theme = materialTheme();
    expect(theme.fieldWrappers).toEqual(['form-field']);
    expect(theme.typeWrappers).toEqual({ checkbox: ['df-field'], radio: ['df-field'] });
    expect(theme.typeProps?.['checkbox']).toEqual({ hideLabel: true });
    expect(theme.formlyConfig?.wrappers?.map((w) => w.name)).toContain('df-field');
  });

  it('se puede volver al wrapper del paquete con overrides', () => {
    expect(materialTheme([], { typeWrappers: {} }).typeWrappers).toEqual({});
  });

  it('bootstrapTheme no cambia', () => {
    expect(bootstrapTheme().typeWrappers).toBeUndefined();
  });
});
