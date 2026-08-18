import { HttpClient } from '@angular/common/http';
import { Injectable, signal, computed } from '@angular/core';
import { Observable, tap, of, catchError } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  AuthenticatedUser,
  ChangePasswordPayload,
  SignInPayload,
  SignInResponse,
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<AuthenticatedUser | null>(null);
  private readonly initializedSignal = signal(false);

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly initialized = computed(() => this.initializedSignal());

  constructor(private readonly http: HttpClient) {}

  signIn(payload: SignInPayload): Observable<SignInResponse> {
    return this.http
      .post<SignInResponse>(`${API_BASE_URL}/auth/sign-in`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((res) => {
          this.currentUserSignal.set(res.user);
          this.initializedSignal.set(true);
        }),
      );
  }

  signOut(): Observable<{ ok: true }> {
    return this.http
      .post<{ ok: true }>(`${API_BASE_URL}/auth/sign-out`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.currentUserSignal.set(null);
        }),
      );
  }

  loadCurrentUser(): Observable<AuthenticatedUser | null> {
    return this.http
      .get<AuthenticatedUser>(`${API_BASE_URL}/auth/me`, { withCredentials: true })
      .pipe(
        tap((user) => {
          this.currentUserSignal.set(user);
          this.initializedSignal.set(true);
        }),
        catchError(() => {
          this.currentUserSignal.set(null);
          this.initializedSignal.set(true);
          return of(null);
        }),
      );
  }

  changePassword(payload: ChangePasswordPayload): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API_BASE_URL}/auth/change-password`,
      payload,
      { withCredentials: true },
    );
  }

  forgotPassword(username: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API_BASE_URL}/auth/forgot-password`,
      { username },
      { withCredentials: true },
    );
  }

  resetPassword(payload: { token: string; passwordNueva: string }): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API_BASE_URL}/auth/reset-password`,
      payload,
      { withCredentials: true },
    );
  }

  clearLocalSession(): void {
    this.currentUserSignal.set(null);
  }

  hasPermiso(permiso: string): boolean {
    return this.currentUserSignal()?.permisos.includes(permiso) ?? false;
  }

  /**
   * OR: alcanza con tener uno de los permisos.
   *
   * Es la semántica correcta para el acceso a una SECCIÓN ("puede entrar a Personal si puede
   * hacer alguna de estas cosas") y para el par global / `.unidad` de un mismo permiso.
   */
  hasAnyPermiso(permisos: string[]): boolean {
    const user = this.currentUserSignal();
    if (!user) return false;
    return permisos.some((p) => user.permisos.includes(p));
  }

  /**
   * AND: exige todos los permisos, igual que el `PermissionsGuard` del backend.
   *
   * Usar para habilitar una ACCIÓN puntual que en el backend está declarada con varios
   * permisos a la vez. Para acceso a secciones va `hasAnyPermiso`.
   */
  hasAllPermisos(permisos: string[]): boolean {
    const user = this.currentUserSignal();
    if (!user) return false;
    return permisos.every((p) => user.permisos.includes(p));
  }

  /**
   * Resuelve el alcance de un permiso segmentable, con la misma regla que el `AlcanceGuard`
   * del backend: el permiso global gana sobre la variante `.unidad`.
   */
  alcanceDe(permisoBase: string): 'global' | 'unidad' | null {
    if (this.hasPermiso(permisoBase)) return 'global';
    if (this.hasPermiso(`${permisoBase}.unidad`)) return 'unidad';
    return null;
  }

  /** Acceso a una pantalla segmentable: sirve el permiso global o el `.unidad`. */
  puedeConAlcance(permisoBase: string): boolean {
    return this.alcanceDe(permisoBase) !== null;
  }

  /** Unidades que acotan lo que el usuario ve, o `null` si su alcance es general. */
  readonly unidadDeAlcance = computed(() => {
    const user = this.currentUserSignal();
    if (!user) return null;
    const tieneAlcanceAcotado = user.permisos.some((p) => p.endsWith('.unidad'));
    if (!tieneAlcanceAcotado) return null;
    if (user.unidades.length === 0) return null;
    return user.unidades.map((u) => u.denominacion).join(', ');
  });
}
