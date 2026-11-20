import { Injectable } from '@angular/core';
import { DfOption, DfOptionsProvider } from '@core/dynamic-forms';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

const BARRIOS: Record<string, DfOption[]> = {
  '28079': [
    { value: 'centro', label: 'Centro' },
    { value: 'chamberi', label: 'Chamberí' },
    { value: 'retiro', label: 'Retiro' },
  ],
  '08019': [
    { value: 'eixample', label: 'Eixample' },
    { value: 'gracia', label: 'Gràcia' },
  ],
  '41091': [
    { value: 'triana', label: 'Triana' },
    { value: 'nervion', label: 'Nervión' },
  ],
};

/** Resolver de options.source === 'remote' (DF_OPTIONS_PROVIDER). */
@Injectable()
export class DemoOptionsProvider implements DfOptionsProvider {
  load(endpoint: string, params: Record<string, unknown>): Observable<DfOption[]> {
    if (endpoint === '/api/barrios') {
      return of(BARRIOS[String(params['municipio'])] ?? [{ value: 'unico', label: 'Único' }]).pipe(delay(400));
    }
    return of([]);
  }
}
