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
  /**
   * Unidad derivada de la relación laboral activa del funcionario. Determina los permisos
   * heredados y el alcance de datos. `null` si el usuario no tiene relación laboral activa.
   */
  unidadId: string | null;
  unidadDenominacion: string | null;
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

export interface PaginatedPermisosResponse {
  items: Permiso[];
  total: number;
  page: number;
  pageSize: number;
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
  /** Derivada de la relación laboral activa: solo lectura desde la pantalla de usuarios. */
  unidad: CatalogoRef | null;
  persona: UsuarioPersona | null;
  roles: UsuarioRol[];
}

export interface PaginatedUsuariosResponse {
  items: Usuario[];
  total: number;
  page: number;
  pageSize: number;
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

export interface Invitacion {
  id: string;
  email: string;
  estado: 'pendiente' | 'aceptada' | 'expirada';
  roles: string[];
  personaId?: string | null;
  creadoEn: string;
  expiraEn: string;
  usadoEn?: string | null;
}

export interface CreateInvitacionPayload {
  email: string;
  personaId?: number | null;
  roles?: string[];
}

export interface VerificarInvitacionResponse {
  valida: boolean;
  email: string;
}
