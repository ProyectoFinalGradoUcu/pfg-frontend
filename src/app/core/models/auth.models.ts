export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ServiceStatus {
  http_status: string;
  http_message: string;
}

export interface ServiceResponse<T> {
  service_response: {
    service_status: ServiceStatus;
    service_data: T;
  };
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  roles: string[];
  permisos: string[];
}

export interface SignInResponse {
  user: AuthenticatedUser;
}

export interface SignInPayload {
  username: string;
  password: string;
}

export interface ChangePasswordPayload {
  passwordActual: string;
  passwordNueva: string;
}

export interface Permiso {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  protegido: boolean;
  cantidadUsuarios: number;
  permisos: { id: string; nombre: string }[];
}

export interface CreateRolPayload {
  nombre: string;
  descripcion?: string;
  permisos?: string[];
}

export interface UpdateRolPayload {
  nombre?: string;
  descripcion?: string;
}

export interface UsuarioRol {
  id: string;
  nombre: string;
}

export interface CatalogoRef {
  id: string;
  codigo: string;
  denominacion: string;
}

export interface RelacionLaboralResumen {
  id: string;
  fechaInicio: string;
  tipoFuncionario: string | null;
  unidad: CatalogoRef | null;
  grado: CatalogoRef | null;
  escalafon: CatalogoRef | null;
  situacion: CatalogoRef | null;
}

export interface UsuarioPersona {
  id: string;
  cedula: string;
  nombre: string;
  email: string | null;
  relacionLaboral: RelacionLaboralResumen | null;
}

export interface Usuario {
  id: string;
  username: string;
  estado: 'activo' | 'bloqueado';
  bloqueadoHasta: string | null;
  persona: UsuarioPersona | null;
  roles: UsuarioRol[];
}

export interface CreateUsuarioPayload {
  username: string;
  password: string;
  personaId?: string;
  roles?: string[];
}

export interface UpdateUsuarioPayload {
  estado?: 'activo' | 'bloqueado';
  personaId?: string | null;
}

export interface ResetPasswordPayload {
  password: string;
}
