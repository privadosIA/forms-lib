import {
  amountError, amountToWords, currencySymbol, editableAmount, formatAmount, integerToWords, integerToWordsEn, parseAmount,
} from './currency';

const NBSP = ' ';

describe('Importes', () => {
  describe('parseAmount en formato español (por defecto)', () => {
    it.each([
      ['500', 500], ['500,7', 500.7], ['500,75', 500.75], ['1.500', 1500], ['1.500.000,75', 1500000.75],
      ['1500,75', 1500.75], [' 1.500,75 € ', 1500.75], ['1.500,75€', 1500.75], [`1.500,75${NBSP}€`, 1500.75],
      ['€ 500', 500], ['500 EUR', 500], ['0', 0], ['0,05', 0.05],
    ])('lee %j como %d', (texto, valor) => {
      expect(parseAmount(texto)).toEqual({ ok: true, value: valor });
    });

    it('un texto vacío es un importe vacío', () => {
      expect(parseAmount('')).toEqual({ ok: true, value: null });
      expect(parseAmount('  ')).toEqual({ ok: true, value: null });
    });

    it.each(['500,123', '1.500,7525'])('%j tiene demasiados decimales', (texto) => {
      expect(parseAmount(texto)).toEqual({ ok: false, error: 'decimals' });
    });

    it.each([
      '12.12', '500.000.75', '1.50', 'abc', '12a', '-5', '1,2,3', ',5', '5,', '1500.75',
      '1 500', '15 00', '1.500 ,75', '500 € €', '500€x', '£500', '1,500.75',
    ])('%j no tiene un formato válido', (texto) => {
      expect(parseAmount(texto)).toEqual({ ok: false, error: 'format' });
    });
  });

  describe('parseAmount en formato inglés', () => {
    it.each([
      ['500', 500], ['500.75', 500.75], ['1,500', 1500], ['1,500,000.75', 1500000.75], ['1500.75', 1500.75],
      ['£1,500.75', 1500.75], ['£ 500', 500], ['500 GBP', 500],
    ])('lee %j como %d (GBP)', (texto, valor) => {
      expect(parseAmount(texto, 'en', 'GBP')).toEqual({ ok: true, value: valor });
    });

    it.each(['1.500,75', '12,12', '1,50', '15 00', '€500', '1500,75'])('%j no tiene un formato válido', (texto) => {
      expect(parseAmount(texto, 'en', 'GBP')).toEqual({ ok: false, error: 'format' });
    });

    it('detecta decimales de más', () => {
      expect(parseAmount('10.555', 'en', 'GBP')).toEqual({ ok: false, error: 'decimals' });
    });
  });

  describe('amountError', () => {
    it('vacío y números válidos no tienen error', () => {
      [null, undefined, '', 0, 12, 12.5, 12.34].forEach((v) => expect(amountError(v), String(v)).toBeNull());
    });

    it('detecta decimales de más y valores imposibles en números', () => {
      expect(amountError(12.345)).toBe('decimals');
      expect(amountError(-1)).toBe('format');
      expect(amountError(Number.NaN)).toBe('format');
      expect(amountError(true)).toBe('format');
    });

    it('en textos usa las reglas del formato indicado', () => {
      expect(amountError('1.500,75')).toBeNull();
      expect(amountError('1.500,75', 'en')).toBe('format');
      expect(amountError('1,500.75', 'en')).toBeNull();
      expect(amountError('12,345')).toBe('decimals');
    });
  });

  describe('formato y símbolos', () => {
    it.each([
      [1500.75, 'EUR', 'es', `1.500,75${NBSP}€`], [5, 'EUR', 'es', `5,00${NBSP}€`], [1500.75, 'GBP', 'es', `1.500,75${NBSP}£`],
      [1500.75, 'GBP', 'en', '£1,500.75'], [1500000, 'EUR', 'en', '€1,500,000.00'], [5, 'USD', 'en', '$5.00'],
    ] as const)('formatAmount(%d, %s, %s) → %j', (valor, moneda, formato, texto) => {
      expect(formatAmount(valor, moneda, formato)).toBe(texto);
    });

    it('editableAmount da un texto que se vuelve a leer igual en los dos formatos', () => {
      [0, 5, 1500, 1500.7, 1500.75, 1234567.89].forEach((v) => {
        expect(parseAmount(editableAmount(v)), `es ${v}`).toEqual({ ok: true, value: v });
        expect(parseAmount(editableAmount(v, 'en'), 'en'), `en ${v}`).toEqual({ ok: true, value: v });
      });
      expect(editableAmount(1500.75)).toBe('1500,75');
      expect(editableAmount(1500.75, 'en')).toBe('1500.75');
    });

    it('currencySymbol da el símbolo corto', () => {
      expect(['EUR', 'GBP', 'USD', 'CHF'].map(currencySymbol)).toEqual(['€', '£', '$', 'CHF']);
    });
  });

  describe('integerToWords (español)', () => {
    it.each([
      [0, 'cero'], [1, 'uno'], [10, 'diez'], [15, 'quince'], [16, 'dieciséis'], [21, 'veintiuno'], [22, 'veintidós'],
      [30, 'treinta'], [31, 'treinta y uno'], [99, 'noventa y nueve'], [100, 'cien'], [101, 'ciento uno'],
      [115, 'ciento quince'], [200, 'doscientos'], [500, 'quinientos'], [555, 'quinientos cincuenta y cinco'],
      [700, 'setecientos'], [900, 'novecientos'], [1000, 'mil'], [1001, 'mil uno'], [2000, 'dos mil'],
      [21000, 'veintiún mil'], [31000, 'treinta y un mil'], [100000, 'cien mil'], [101000, 'ciento un mil'],
      [999999, 'novecientos noventa y nueve mil novecientos noventa y nueve'], [1000000, 'un millón'],
      [2000000, 'dos millones'], [21000000, 'veintiún millones'], [1000000000, 'mil millones'],
      [1234567, 'un millón doscientos treinta y cuatro mil quinientos sesenta y siete'],
    ])('%d → %s', (n, texto) => {
      expect(integerToWords(n)).toBe(texto);
    });

    it('delante de un sustantivo masculino usa "un" y "veintiún"', () => {
      expect(integerToWords(1, true)).toBe('un');
      expect(integerToWords(21, true)).toBe('veintiún');
      expect(integerToWords(41, true)).toBe('cuarenta y un');
      expect(integerToWords(11, true)).toBe('once');
    });

    it.each([
      [1, 'una'], [21, 'veintiuna'], [31, 'treinta y una'], [200, 'doscientas'], [501, 'quinientas una'],
      [101, 'ciento una'], [21000, 'veintiún mil'], [200000, 'doscientas mil'], [2000000, 'dos millones'],
      [200000000, 'doscientos millones'], [1200300, 'un millón doscientas mil trescientas'],
    ])('delante de un sustantivo femenino: %d → %s', (n, texto) => {
      expect(integerToWords(n, true, true)).toBe(texto);
    });
  });

  describe('integerToWordsEn (inglés británico)', () => {
    it.each([
      [0, 'zero'], [1, 'one'], [13, 'thirteen'], [21, 'twenty-one'], [40, 'forty'], [100, 'one hundred'],
      [105, 'one hundred and five'], [250, 'two hundred and fifty'], [1000, 'one thousand'],
      [1005, 'one thousand and five'], [1250, 'one thousand two hundred and fifty'], [21000, 'twenty-one thousand'],
      [1000000, 'one million'], [1000005, 'one million and five'],
      [2500000000, 'two billion five hundred million'],
    ])('%d → %s', (n, texto) => {
      expect(integerToWordsEn(n)).toBe(texto);
    });
  });

  describe('amountToWords', () => {
    it.each([
      [0, 'cero euros'], [1, 'un euro'], [2, 'dos euros'], [21, 'veintiún euros'], [100, 'cien euros'],
      [1250.5, 'mil doscientos cincuenta euros con cincuenta céntimos'],
      [1500000.75, 'un millón quinientos mil euros con setenta y cinco céntimos'],
      [1000000, 'un millón de euros'], [3000000, 'tres millones de euros'], [1000100, 'un millón cien euros'],
      [0.01, 'un céntimo'], [0.21, 'veintiún céntimos'], [1.01, 'un euro con un céntimo'], [0.1 + 0.2, 'treinta céntimos'],
    ])('euros: %d → %s', (importe, texto) => {
      expect(amountToWords(importe)).toBe(texto);
    });

    it.each([
      [1, 'una libra'], [21, 'veintiuna libras'], [200, 'doscientas libras'], [1.01, 'una libra con un penique'],
      [200000, 'doscientas mil libras'], [1000000, 'un millón de libras'], [0.5, 'cincuenta peniques'],
    ])('libras en español (femenino): %d → %s', (importe, texto) => {
      expect(amountToWords(importe, { currency: 'GBP' })).toBe(texto);
    });

    it.each([
      [1, 'one pound'], [1.01, 'one pound and one penny'], [1250.5, 'one thousand two hundred and fifty pounds and fifty pence'],
      [0.5, 'fifty pence'], [0, 'zero pounds'], [1000000, 'one million pounds'],
    ])('libras en inglés: %d → %s', (importe, texto) => {
      expect(amountToWords(importe, { currency: 'GBP', language: 'en' })).toBe(texto);
    });

    it('dólares y euros en inglés', () => {
      expect(amountToWords(21.01, { currency: 'USD', language: 'en' })).toBe('twenty-one dollars and one cent');
      expect(amountToWords(2, { currency: 'EUR', language: 'en' })).toBe('two euros');
      expect(amountToWords(1.5, { currency: 'USD' })).toBe('un dólar con cincuenta centavos');
    });

    it('admite nombres propios para otra moneda, también femeninos', () => {
      const coronas = { singular: 'corona', plural: 'coronas', centSingular: 'céntimo', centPlural: 'céntimos', feminine: true };
      expect(amountToWords(201, { currency: 'SEK', words: coronas })).toBe('doscientas una coronas');
    });

    it('sin nombres para la moneda o fuera de rango devuelve vacío', () => {
      expect(amountToWords(5, { currency: 'CHF' })).toBe('');
      [-1, Number.NaN, Number.POSITIVE_INFINITY, 1e12].forEach((v) => expect(amountToWords(v), String(v)).toBe(''));
    });
  });
});
