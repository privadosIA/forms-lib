import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FieldType, FieldTypeConfig, FormlyModule } from '@ngx-formly/core';
import {
  DfCurrencyWords, DfNumberFormat, DfWordsLanguage, amountToWords, editableAmount, formatAmount, parseAmount,
} from '../../utils/currency';

/**
 * Importe. Mientras se edita muestra el texto tal cual ("1500,75"); al salir lo formatea
 * ("1.500,75 €" o "£1,500.75") y debajo escribe el importe en letra. El modelo guarda un number; si
 * el texto no se puede leer, guarda el texto para que los validadores currencyFormat/currencyDecimals
 * lo marquen como inválido.
 *
 * Props (el adaptador las resuelve con la config de provideDynamicForms({ currency })): currency
 * (ISO 4217), numberFormat ('es' | 'en'), wordsLanguage ('es' | 'en'), amountInWords, wordsUppercase
 * y currencyWords (nombres de una moneda que no esté incluida).
 *
 * Sin [formControl]: el input muestra un texto distinto del valor del modelo, así que el valor se
 * escribe a mano en el elemento.
 */
@Component({
  selector: 'df-currency-field',
  standalone: true,
  imports: [FormlyModule],
  templateUrl: './currency-field.component.html',
  styleUrl: './currency-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyFieldComponent extends FieldType<FieldTypeConfig> implements AfterViewInit {
  @ViewChild('input', { static: true }) private input!: ElementRef<HTMLInputElement>;
  private readonly destroyRef = inject(DestroyRef);
  private focused = false;

  ngAfterViewInit(): void {
    this.render();
    // Cambios que no vienen del usuario (reset, modelo inicial cargado después…).
    this.formControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { if (!this.focused) this.render(); });
  }

  get currency(): string {
    return (this.props['currency'] as string | undefined) ?? 'EUR';
  }

  get numberFormat(): DfNumberFormat {
    return (this.props['numberFormat'] as DfNumberFormat | undefined) ?? 'es';
  }

  get words(): string {
    const value = this.formControl.value;
    if (this.props['amountInWords'] === false || typeof value !== 'number') return '';
    const language = (this.props['wordsLanguage'] as DfWordsLanguage | undefined) ?? 'es';
    const words = amountToWords(value, {
      currency: this.currency,
      language,
      words: this.props['currencyWords'] as DfCurrencyWords | undefined,
    });
    return this.props['wordsUppercase'] === false ? words : words.toLocaleUpperCase(language === 'en' ? 'en-GB' : 'es-ES');
  }

  onFocus(): void {
    this.focused = true;
    const value = this.formControl.value;
    if (typeof value === 'number') this.input.nativeElement.value = editableAmount(value, this.numberFormat);
  }

  onInput(text: string): void {
    const parsed = parseAmount(text, this.numberFormat, this.currency);
    this.formControl.setValue(parsed.ok ? parsed.value : text);
    this.formControl.markAsDirty();
  }

  onBlur(): void {
    this.focused = false;
    this.formControl.markAsTouched();
    this.render();
  }

  /** Pinta el valor del control: formateado si es un importe, tal cual si es texto inválido. */
  private render(): void {
    const value = this.formControl.value;
    this.input.nativeElement.value =
      typeof value === 'number' ? formatAmount(value, this.currency, this.numberFormat) : value == null ? '' : String(value);
  }
}
