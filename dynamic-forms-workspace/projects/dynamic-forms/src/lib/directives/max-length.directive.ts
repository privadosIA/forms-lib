import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { DfMaxLengthMode, textLength, truncateToLength } from '../utils/text-length';

/**
 * Bloquea input/textarea en validation.maxLength contando con el mismo modo que el validador.
 * El maxlength nativo cuenta la ñ como 1; en modo 'weighted' cuenta 2, así que al escribir o
 * pegar se recorta lo que sobre.
 */
@Directive({
  selector: 'input[dfMaxLength], textarea[dfMaxLength]',
  standalone: true,
})
export class DfMaxLengthDirective {
  readonly dfMaxLength = input<number | undefined>();
  readonly dfMaxLengthMode = input<DfMaxLengthMode>('weighted');

  private readonly el = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);
  private readonly control = inject(NgControl, { optional: true, self: true });

  @HostListener('input')
  onInput(): void {
    const max = this.dfMaxLength();
    const mode = this.dfMaxLengthMode();
    const value = this.el.nativeElement.value;
    if (max == null || textLength(value, mode) <= max) return;
    const truncated = truncateToLength(value, max, mode);
    this.el.nativeElement.value = truncated;
    this.control?.control?.setValue(truncated);
  }
}
