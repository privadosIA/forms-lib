import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DfTablePage, DfTableProvider, DfTableRequest } from '@core/dynamic-forms';
import { Observable } from 'rxjs';

type Row = Record<string, unknown>;

/**
 * Resolver de table.source (DF_TABLE_PROVIDER). Traduce lo que pide la tabla a una llamada HTTP:
 * en modo client solo hay endpoint y parámetros; en modo server se añaden página, tamaño, orden (uno o varios criterios) y búsqueda.
 */
@Injectable()
export class DemoTableProvider implements DfTableProvider {
  private readonly http = inject(HttpClient);

  load(endpoint: string, request: DfTableRequest): Observable<DfTablePage | Row[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(request.params)) params = params.set(key, String(value));
    if (request.pageSize) params = params.set('page', request.page).set('size', request.pageSize);
    // Un parámetro `sort=clave:sentido` por columna, de la principal a la que desempata.
    for (const s of request.sorts) params = params.append('sort', `${s.key}:${s.direction}`);
    for (const [key, value] of Object.entries(request.columnFilters)) params = params.set(`filter.${key}`, value);
    if (request.filter) params = params.set('q', request.filter);
    return this.http.get<DfTablePage | Row[]>(endpoint, { params });
  }
}
