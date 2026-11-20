import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { EXPEDIENTES, paginaDeExpedientes } from './mock-expedientes';
import { MOCK_FORMS } from './mock-forms';

const FORMS_URL = /^\/?api\/forms\/([\w-]+)$/;
const EXPEDIENTES_URL = /^\/?api\/expedientes(\/paginado|\/error)?$/;

/**
 * Backend simulado: atiende GET /api/forms/:id con latencia y devuelve 404 si el id
 * no existe. Para usar un servicio real basta con quitar este interceptor de app.config.
 * Con el id especial `error` responde 500 para probar el estado de fallo.
 *
 * También atiende los datos de las tablas:
 *   GET /api/expedientes            → todas las filas (la tabla pagina en el cliente)
 *   GET /api/expedientes/paginado   → una página: ?page&size&sort=clave:asc|desc (repetido)&q&estado&filter.asunto&filter.urgente → { rows, total }
 *   GET /api/expedientes/error      → 500
 */
export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const table = req.method === 'GET' ? EXPEDIENTES_URL.exec(req.url) : null;
  if (table) {
    if (table[1] === '/error') {
      return throwError(() => new HttpErrorResponse({ url: req.url, status: 500, statusText: 'Internal Server Error' })).pipe(delay(500));
    }
    const body = table[1]
      ? paginaDeExpedientes({
          page: Number(req.params.get('page') ?? 0),
          size: Number(req.params.get('size') ?? 10),
          sorts: req.params.getAll('sort')?.map((s) => ({ key: s.split(':')[0], dir: s.split(':')[1] === 'desc' ? 'desc' as const : 'asc' as const })) ?? [],
          q: req.params.get('q') ?? '',
          estado: req.params.get('estado') ?? 'todos',
          asunto: req.params.get('filter.asunto') ?? '',
          urgente: req.params.get('filter.urgente') ?? '',
        })
      : EXPEDIENTES;
    return of(new HttpResponse({ url: req.url, status: 200, body })).pipe(delay(table[1] ? 450 : 700));
  }
  const match = req.method === 'GET' ? FORMS_URL.exec(req.url) : null;
  if (!match) return next(req);

  const id = match[1];
  let response$: Observable<HttpResponse<unknown>>;
  if (id === 'error') {
    response$ = throwError(() => new HttpErrorResponse({ url: req.url, status: 500, statusText: 'Internal Server Error' }));
  } else if (MOCK_FORMS[id]) {
    response$ = of(new HttpResponse({ url: req.url, status: 200, body: structuredClone(MOCK_FORMS[id]) }));
  } else {
    response$ = throwError(() => new HttpErrorResponse({ url: req.url, status: 404, statusText: 'Not Found' }));
  }
  return response$.pipe(delay(700));
};
