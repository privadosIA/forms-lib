import { resolveMaxLengthMode, textLength, truncateToLength } from './text-length';

describe('Longitud de texto para maxLength', () => {
  it.each([
    ['', 0], ['abc', 3], ['año', 4], ['ñññ', 6], ['Ácido úrico', 13], ['10 €', 5], ['ü', 2], ['👍', 2], ['a👍b', 4],
  ])('weighted: %j cuenta %d', (texto, n) => {
    expect(textLength(texto)).toBe(n);
  });

  it('chars: cada carácter cuenta 1 (un emoji también)', () => {
    expect(textLength('año', 'chars')).toBe(3);
    expect(textLength('a👍b', 'chars')).toBe(3);
  });

  it('recorta sin pasarse del máximo', () => {
    expect(truncateToLength('abcdef', 4)).toBe('abcd');
    expect(truncateToLength('ñññ', 5)).toBe('ññ');
    expect(truncateToLength('abcñ', 4), 'la ñ ya no cabe entera').toBe('abc');
    expect(truncateToLength('abcñ', 5)).toBe('abcñ');
    expect(truncateToLength('ñññ', 2, 'chars')).toBe('ññ');
  });

  it('no parte un emoji por la mitad', () => {
    expect(truncateToLength('a👍', 2)).toBe('a');
    expect(truncateToLength('a👍', 3)).toBe('a👍');
  });

  it('resuelve el modo del campo o usa el de la config', () => {
    expect(resolveMaxLengthMode('chars', 'weighted')).toBe('chars');
    expect(resolveMaxLengthMode('weighted', 'chars')).toBe('weighted');
    expect(resolveMaxLengthMode(undefined, 'chars')).toBe('chars');
    expect(resolveMaxLengthMode('bytes', 'weighted')).toBe('weighted');
  });
});
