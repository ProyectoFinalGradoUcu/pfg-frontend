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
  // Lo arma el backend, en eventos viejos puede faltar
  resumen?: string | null;
  nombres?: Record<string, string> | null;
  entidadNombre?: string | null;
}

export interface AuditoriaFiltroItem {
  id: string;
  nombre: string;
}

export interface AuditoriaFiltros {
  acciones: AuditoriaFiltroItem[];
  contextos: AuditoriaFiltroItem[];
  usuarios: AuditoriaUsuario[];
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
