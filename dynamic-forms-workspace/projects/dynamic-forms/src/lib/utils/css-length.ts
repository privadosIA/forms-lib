/**
 * Longitud CSS simple (0, 12px, 1.5rem, 2em, 5%…). Es todo lo que admite layout.gap:
 * nada de url(), var() ni calc(), porque el valor viene del backend y acaba en un estilo.
 */
const CSS_LENGTH_RE = /^(0|\d*\.?\d+(px|rem|em|%|vw|vh))$/;

export const isCssLength = (value: unknown): value is string =>
  typeof value === 'string' && CSS_LENGTH_RE.test(value.trim());
