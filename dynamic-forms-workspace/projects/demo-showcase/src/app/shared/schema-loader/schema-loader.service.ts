import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DfFormSchema } from '@core/dynamic-forms';
import { Observable } from 'rxjs';

/** Simula el endpoint del backend/Appian que devuelve metadatos de formulario. */
@Injectable({ providedIn: 'root' })
export class SchemaLoaderService {
  private readonly http = inject(HttpClient);

  load(name: string): Observable<DfFormSchema> {
    return this.http.get<DfFormSchema>(`schemas/${name}.json`);
  }

  /** Pide el esquema a un servicio externo (aquí lo atiende el backend simulado). */
  loadRemote(id: string): Observable<DfFormSchema> {
    return this.http.get<DfFormSchema>(`/api/forms/${encodeURIComponent(id)}`);
  }
}
