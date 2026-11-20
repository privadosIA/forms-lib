import { DEFAULT_VALIDATION_MESSAGES, EN_VALIDATION_MESSAGES } from './validation-messages';
import { DEFAULT_TABLE_TEXTS, EN_TABLE_TEXTS } from '../utils/table-texts';

describe('juegos de textos en inglés', () => {
  it('cubren las mismas claves que los de español', () => {
    expect(Object.keys(EN_VALIDATION_MESSAGES).sort()).toEqual(Object.keys(DEFAULT_VALIDATION_MESSAGES).sort());
    expect(Object.keys(EN_TABLE_TEXTS).sort()).toEqual(Object.keys(DEFAULT_TABLE_TEXTS).sort());
  });

  it('los textos con llaves conservan los mismos marcadores', () => {
    const marks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(DEFAULT_TABLE_TEXTS) as (keyof typeof EN_TABLE_TEXTS)[]) {
      expect(marks(EN_TABLE_TEXTS[k])).toEqual(marks(DEFAULT_TABLE_TEXTS[k]));
    }
  });

  it('los mensajes con función devuelven texto en inglés', () => {
    const min = EN_VALIDATION_MESSAGES['min'] as (e: unknown) => string;
    expect(min({ min: 3 })).toBe('The minimum value is 3');
  });
});
