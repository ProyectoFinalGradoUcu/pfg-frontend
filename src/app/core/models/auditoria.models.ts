export interface AuditoriaUsuario {
  id: string;
  username: string;
}

export interface AuditoriaRegistro {
  id: string;
  fecha: string;
  accion: string;
  contexto: string;
  entidad: string | null;
  entidadId: string | null;
  host: string | null;
  detalle: unknown;
  usuario: AuditoriaUsuario;
}

export interface AuditoriaFiltroItem {
  id: string;
  nombre: string;
}

export interface AuditoriaFiltros {
  acciones: AuditoriaFiltroItem[];
  contextos: AuditoriaFiltroItem[];
}

export interface AuditoriaQuery {
  page: number;
  pageSize: number;
  usuarioId?: string;
  accion?: string;
  contexto?: string;
  entidad?: string;
  desde?: string;
  hasta?: string;
}
