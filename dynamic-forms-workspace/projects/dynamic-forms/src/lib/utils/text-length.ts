/**
 * Longitud de texto para validation.maxLength. Por defecto ('weighted') cada carácter no ASCII
 * (ñ, á, ü, €…) cuenta 2, porque el backend mide el límite como si fueran bytes; con 'chars'
 * cada carácter cuenta 1.
 */
export type DfMaxLengthMode = 'weighted' | 'chars';

/** Longitud según el modo. Recorre code points, así que un emoji cuenta como un solo carácter (2). */
export function textLength(text: string, mode: DfMaxLengthMode = 'weighted'): number {
  let length = 0;
  for (const char of text) length += mode === 'weighted' && char.codePointAt(0)! > 127 ? 2 : 1;
  return length;
}

/** Recorta el texto para que su longitud no pase de max, sin partir caracteres. */
export function truncateToLength(text: string, max: number, mode: DfMaxLengthMode = 'weighted'): string {
  let length = 0;
  let out = '';
  for (const char of text) {
    const weight = mode === 'weighted' && char.codePointAt(0)! > 127 ? 2 : 1;
    if (length + weight > max) break;
    length += weight;
    out += char;
  }
  return out;
}

/** Modo de un campo: props.maxLengthMode si es válido; si no, el de la config. */
export const resolveMaxLengthMode = (prop: unknown, fallback: DfMaxLengthMode): DfMaxLengthMode =>
  prop === 'chars' || prop === 'weighted' ? prop : fallback;
