export interface PermisoDeRol {
  id: string;
  nombre: string;
}

export interface RolDeUnidad {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: PermisoDeRol[];
}

export interface UnidadListItem {
  id: string;
  codigo: string;
  denominacion: string;
  vigente: boolean;
  cantidadRoles: number;
  /** Usuarios del sistema asignados a la unidad: los que quedarían deslogueados. */
  cantidadUsuarios: number;
  /** Funcionarios con relación laboral activa destinados en la unidad. */
  cantidadFuncionarios: number;
}

export interface UnidadDetalle {
  id: string;
  codigo: string;
  denominacion: string;
  vigente: boolean;
  roles: RolDeUnidad[];
  cantidadUsuarios: number;
  cantidadFuncionarios: number;
}

/** Cuenta de la aplicación asignada a la unidad. No es un funcionario del padrón. */
export interface UsuarioDeUnidad {
  id: string;
  username: string;
  nombre: string | null;
  estado: string;
  rolesDirectos: string[];
}

export interface UsuariosDeUnidadResponse {
  items: UsuarioDeUnidad[];
  total: number;
}

/** Resumen de una asignación masiva de usuarios del sistema. */
export interface ResultadoAsignacion {
  asignados: number;
  yaEstaban: number;
  noEncontrados: number;
}

export interface PaginatedUnidadesResponse {
  items: UnidadListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListUnidadesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  vigente?: boolean;
}
