import { csvFileName } from './csv';

describe('csvFileName', () => {
  it('añade .csv una sola vez y deja nombres normales', () => {
    expect(csvFileName('informe')).toBe('informe.csv');
    expect(csvFileName('informe.CSV')).toBe('informe.csv');
    expect(csvFileName('mi informe 2024')).toBe('mi informe 2024.csv');
  });

  it('quita rutas y caracteres raros, y cae a "tabla" si no queda nada', () => {
    expect(csvFileName('../../etc/passwd')).toBe('_.._etc_passwd.csv');
    expect(csvFileName('a/b\\c:d')).toBe('a_b_c_d.csv');
    expect(csvFileName('...')).toBe('tabla.csv');
    expect(csvFileName('')).toBe('tabla.csv');
  });
});
