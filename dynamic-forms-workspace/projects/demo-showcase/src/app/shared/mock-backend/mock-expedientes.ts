export interface Expediente {
  numero: string;
  asunto: string;
  fecha: string;
  estado: 'P' | 'A' | 'R';
  importe: number | null;
  urgente: boolean;
}

const ASUNTOS = [
  'Renovación de licencia', 'Alta de actividad', 'Cambio de titularidad', 'Solicitud de subvención',
  'Reclamación de recibo', 'Baja de suministro', 'Ampliación de plazo', 'Certificado de empadronamiento',
  'Licencia de obra menor', 'Recurso de alzada', 'Autorización de evento', 'Devolución de ingresos',
];
const ESTADOS: Expediente['estado'][] = ['P', 'A', 'R'];

/** 137 expedientes deterministas (siempre los mismos) para probar la paginación en cliente y en servidor. */
export const EXPEDIENTES: Expediente[] = Array.from({ length: 137 }, (_, i) => {
  const mes = (i * 5) % 12 + 1;
  const dia = (i * 7) % 28 + 1;
  const hora = i % 3 === 0 ? `T${String(8 + (i % 10)).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00` : '';
  return {
    numero: `EXP-2024-${String(i + 1).padStart(3, '0')}`,
    asunto: ASUNTOS[(i * 7) % ASUNTOS.length],
    fecha: `2024-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}${hora}`,
    estado: ESTADOS[(i * 5) % 3],
    importe: i % 11 === 6 ? null : Math.round(((i * 137) % 5000 + 12.5) * 100) / 100,
    urgente: i % 4 === 0,
  };
});

const ESTADO_TEXTO = { P: 'pendiente', A: 'aprobado', R: 'rechazado' };

export interface PaginaQuery {
  page: number;
  size: number;
  /** Criterios de orden, del principal al último que desempata. */
  sorts: { key: string; dir: 'asc' | 'desc' }[];
  q: string;
  estado: string;
  /** Filtros por columna (`filter.<key>` en la URL): `asunto` contiene el texto, `urgente` es "true" o "false". */
  asunto?: string;
  urgente?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lo que haría un backend paginado: filtra por estado y texto, ordena, recorta y devuelve el total. */
export function paginaDeExpedientes(query: PaginaQuery): { rows: Expediente[]; total: number } {
  const q = norm(query.q);
  let rows = EXPEDIENTES.filter(
    (e) => (query.estado === 'todos' || e.estado === query.estado)
      && (!q || norm(`${e.numero} ${e.asunto} ${ESTADO_TEXTO[e.estado]}`).includes(q))
      && (!query.asunto || norm(e.asunto).includes(norm(query.asunto)))
      && (!query.urgente || String(e.urgente) === query.urgente),
  );
  const sorts = query.sorts.filter((s) => s.key in EXPEDIENTES[0]);
  if (sorts.length) {
    // Cada criterio desempata al anterior. Los vacíos van al final en cualquier sentido, como en la tabla del cliente.
    rows = [...rows].sort((a, b) => {
      for (const { key, dir } of sorts) {
        const [x, y] = [a[key as keyof Expediente], b[key as keyof Expediente]];
        if (x === y) continue;
        if (x === null) return 1;
        if (y === null) return -1;
        return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
      }
      return 0;
    });
  }
  return { rows: rows.slice(query.page * query.size, (query.page + 1) * query.size), total: rows.length };
}
