/**
 * Importes: parseo de lo que escribe el usuario, formato para mostrar y conversión a letra
 * (como en cheques y documentos oficiales), en formato español o inglés y para cualquier moneda.
 */

/** 'es': 1.500,75 (punto de miles, coma decimal) · 'en': 1,500.75 (coma de miles, punto decimal). */
export type DfNumberFormat = 'es' | 'en';

/** Idioma del importe en letra. */
export type DfWordsLanguage = 'es' | 'en';

/** Resultado de leer un importe escrito por el usuario. */
export type DfAmountParse =
  | { ok: true; value: number | null }
  | { ok: false; error: 'format' | 'decimals' };

/**
 * Nombres de la moneda para escribir el importe en letra. `feminine` y `centFeminine` solo
 * cuentan en español: "una libra", "doscientas libras".
 */
export interface DfCurrencyWords {
  singular: string;
  plural: string;
  centSingular: string;
  centPlural: string;
  feminine?: boolean;
  centFeminine?: boolean;
}

/** Nombres incluidos. Para otra moneda, pasa currencyWords. */
export const CURRENCY_WORDS: Record<DfWordsLanguage, Record<string, DfCurrencyWords>> = {
  es: {
    EUR: { singular: 'euro', plural: 'euros', centSingular: 'céntimo', centPlural: 'céntimos' },
    GBP: { singular: 'libra', plural: 'libras', centSingular: 'penique', centPlural: 'peniques', feminine: true },
    USD: { singular: 'dólar', plural: 'dólares', centSingular: 'centavo', centPlural: 'centavos' },
  },
  en: {
    EUR: { singular: 'euro', plural: 'euros', centSingular: 'cent', centPlural: 'cents' },
    GBP: { singular: 'pound', plural: 'pounds', centSingular: 'penny', centPlural: 'pence' },
    USD: { singular: 'dollar', plural: 'dollars', centSingular: 'cent', centPlural: 'cents' },
  },
};

const FORMATS: Record<DfNumberFormat, { thousands: string; decimal: string; locale: string; example: string }> = {
  es: { thousands: '.', decimal: ',', locale: 'es-ES', example: '1.500,75' },
  en: { thousands: ',', decimal: '.', locale: 'en-GB', example: '1,500.75' },
};

export const NUMBER_FORMATS: readonly DfNumberFormat[] = ['es', 'en'];
export const WORDS_LANGUAGES: readonly DfWordsLanguage[] = ['es', 'en'];

/** Código ISO 4217 bien formado (EUR, GBP, USD…). */
export const isCurrencyCode = (code: unknown): code is string => typeof code === 'string' && /^[A-Z]{3}$/.test(code);

/** Ejemplo de importe en el formato indicado, para mensajes de error. */
export const amountExample = (format: DfNumberFormat = 'es'): string => (FORMATS[format] ?? FORMATS.es).example;

/** Símbolo corto de la moneda (€, £, $; CHF si no tiene uno propio). */
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Quita un símbolo o código de moneda pegado al principio o al final ("£1,500.75", "1.500,75 €"). */
function stripCurrency(text: string, currency: string): string {
  for (const mark of [currencySymbol(currency), currency]) {
    if (text.startsWith(mark)) return text.slice(mark.length).trimStart();
    if (text.endsWith(mark)) return text.slice(0, -mark.length).trimEnd();
  }
  return text;
}

/**
 * Lee un importe en el formato indicado: separador de miles en grupos de 3, separador decimal y
 * hasta dos decimales, sin negativos. Solo ignora los espacios de los extremos y el símbolo o
 * código de la moneda al principio o al final; un espacio en medio ("15 00") es error de formato.
 * Un texto mal formado es error de formato aunque solo tenga dígitos y separadores ("5,", "1,2,3");
 * el error de decimales queda para un importe bien formado con más de dos. Un texto vacío es un
 * importe vacío (null).
 */
export function parseAmount(text: string, format: DfNumberFormat = 'es', currency = 'EUR'): DfAmountParse {
  const { thousands, decimal } = FORMATS[format] ?? FORMATS.es;
  const clean = stripCurrency(text.trim(), currency);
  if (clean === '') return { ok: true, value: null };
  const t = escapeRe(thousands);
  const d = escapeRe(decimal);
  if (new RegExp(`^(\\d+|\\d{1,3}(${t}\\d{3})+)(${d}\\d{1,2})?$`).test(clean)) {
    return { ok: true, value: Number(clean.split(thousands).join('').replace(decimal, '.')) };
  }
  const tooManyDecimals = new RegExp(`^(\\d+|\\d{1,3}(${t}\\d{3})+)${d}\\d{3,}$`).test(clean);
  return { ok: false, error: tooManyDecimals ? 'decimals' : 'format' };
}

/**
 * Error de un valor de importe tal como lo guarda el control: number si es válido, el texto
 * escrito si no se pudo leer, o vacío. Lo usan los validadores currencyFormat y currencyDecimals.
 */
export function amountError(value: unknown, format: DfNumberFormat = 'es', currency = 'EUR'): 'format' | 'decimals' | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 'format';
    return Math.abs(Math.round(value * 100) - value * 100) > 1e-6 ? 'decimals' : null;
  }
  if (typeof value === 'string') {
    const parsed = parseAmount(value, format, currency);
    return parsed.ok ? null : parsed.error;
  }
  return 'format';
}

/** "1.500,75 €" (es) o "£1,500.75" (en): miles agrupados siempre, también con 4 cifras. */
export function formatAmount(value: number, currency = 'EUR', format: DfNumberFormat = 'es'): string {
  // useGrouping 'always' (Intl ES2023) evita "1500,75 €": es-ES no agrupa por defecto los números de 4 cifras.
  const options = {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol', useGrouping: 'always',
  } as unknown as Intl.NumberFormatOptions;
  return new Intl.NumberFormat((FORMATS[format] ?? FORMATS.es).locale, options).format(value);
}

/** "1.500,75" (es) o "1,500.75" (en) sin símbolo: miles agrupados siempre y hasta dos decimales. */
export function formatNumber(value: number, format: DfNumberFormat = 'es'): string {
  const options = { maximumFractionDigits: 2, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions;
  return new Intl.NumberFormat((FORMATS[format] ?? FORMATS.es).locale, options).format(value);
}

/** "1500,75" (es) o "1500.75" (en): versión editable, sin miles ni símbolo, que parseAmount vuelve a leer. */
export function editableAmount(value: number, format: DfNumberFormat = 'es'): string {
  return String(Math.round(value * 100) / 100).replace('.', (FORMATS[format] ?? FORMATS.es).decimal);
}

// --- Letra en español -------------------------------------------------------

const UNITS = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve',
];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos',
];

/** Cómo termina el "uno" final: suelto ("uno"), delante de sustantivo masculino ("un") o femenino ("una"). */
type Ending = 'uno' | 'un' | 'una';

function below1000(n: number, ending: Ending, feminine: boolean): string {
  if (n === 100) return 'cien';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  // "doscientas libras": las centenas concuerdan en género; "ciento" no cambia.
  const hundreds = feminine && h >= 2 ? HUNDREDS[h].replace(/os$/, 'as') : HUNDREDS[h];
  let restWords = rest < 30 ? UNITS[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` y ${UNITS[rest % 10]}` : ''}`;
  if (ending !== 'uno' && restWords.endsWith('uno')) {
    const base = restWords.slice(0, -3);
    restWords = ending === 'una' ? `${base}una` : `${base}${base.endsWith('veinti') ? 'ún' : 'un'}`;
  }
  return [hundreds, restWords].filter(Boolean).join(' ');
}

function below1e6(n: number, ending: Ending, feminine: boolean): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  // Delante de "mil": "veintiún mil libras", pero "doscientas mil libras".
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${below1000(thousands, 'un', feminine)} mil`);
  if (rest) parts.push(below1000(rest, ending, feminine));
  return parts.join(' ');
}

/**
 * Número entero (0 – 999.999.999.999) en letra. Con beforeNoun usa "un"/"veintiún"; con
 * feminine, "una"/"veintiuna"/"doscientas". "Millón" es masculino: "doscientos millones de libras".
 */
export function integerToWords(n: number, beforeNoun = false, feminine = false): string {
  if (n === 0) return 'cero';
  const ending: Ending = !beforeNoun ? 'uno' : feminine ? 'una' : 'un';
  const millions = Math.floor(n / 1e6);
  const rest = n % 1e6;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? 'un millón' : `${below1e6(millions, 'un', false)} millones`);
  if (rest) parts.push(below1e6(rest, ending, feminine));
  return parts.join(' ');
}

// --- Letra en inglés (británico: "two hundred and fifty") -------------------

const EN_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion'];

const below100En = (n: number): string =>
  n < 20 ? EN_ONES[n] : `${EN_TENS[Math.floor(n / 10)]}${n % 10 ? `-${EN_ONES[n % 10]}` : ''}`;

function below1000En(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (rest) parts.push(`${h ? 'and ' : ''}${below100En(rest)}`);
  return parts.join(' ');
}

/** Número entero (0 – 999.999.999.999) en inglés británico: "one thousand and five". */
export function integerToWordsEn(n: number): string {
  if (n === 0) return 'zero';
  const words: string[] = [];
  for (let rest = n, scale = 0; rest > 0; rest = Math.floor(rest / 1000), scale++) {
    const group = rest % 1000;
    if (!group) continue;
    const text = scale === 0 && group < 100 && n >= 1000 ? `and ${below100En(group)}` : below1000En(group);
    words.unshift(EN_SCALES[scale] ? `${text} ${EN_SCALES[scale]}` : text);
  }
  return words.join(' ');
}

// --- Importe en letra ---------------------------------------------------------

export interface DfAmountWordsOptions {
  /** Código ISO 4217 de la moneda incluida (EUR, GBP, USD). Por defecto, EUR. */
  currency?: string;
  /** Idioma de la letra. Por defecto, español. */
  language?: DfWordsLanguage;
  /** Nombres de la moneda; obligatorios para monedas que no estén en CURRENCY_WORDS. */
  words?: DfCurrencyWords;
}

/**
 * Importe en letra, en minúsculas:
 * - 1250.5 EUR, es → "mil doscientos cincuenta euros con cincuenta céntimos"
 * - 1250.5 GBP, en → "one thousand two hundred and fifty pounds and fifty pence"
 *
 * Devuelve '' si el importe no está entre 0 y 999.999.999.999,99 o si no hay nombres para la moneda.
 */
export function amountToWords(amount: number, options: DfAmountWordsOptions = {}): string {
  const language = options.language ?? 'es';
  const names = options.words ?? CURRENCY_WORDS[language]?.[options.currency ?? 'EUR'];
  if (!names || !Number.isFinite(amount) || amount < 0 || amount >= 1e12) return '';
  const totalCents = Math.round(amount * 100);
  const units = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const parts: string[] = [];

  if (language === 'en') {
    if (units > 0 || cents === 0) parts.push(`${integerToWordsEn(units)} ${units === 1 ? names.singular : names.plural}`);
    if (cents > 0) parts.push(`${integerToWordsEn(cents)} ${cents === 1 ? names.centSingular : names.centPlural}`);
    return parts.join(' and ');
  }

  if (units > 0 || cents === 0) {
    // "un millón de euros", pero "un millón cien euros".
    const linker = units >= 1e6 && units % 1e6 === 0 ? ' de' : '';
    parts.push(`${integerToWords(units, true, !!names.feminine)}${linker} ${units === 1 ? names.singular : names.plural}`);
  }
  if (cents > 0) {
    parts.push(`${integerToWords(cents, true, !!names.centFeminine)} ${cents === 1 ? names.centSingular : names.centPlural}`);
  }
  return parts.join(' con ');
}
