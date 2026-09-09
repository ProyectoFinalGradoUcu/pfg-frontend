import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  CrearReglaPayload,
  CursoDelCatalogo,
  EditarReglaPayload,
  EscaleraReglas,
  EscalonRegla,
  ImpactoRegla,
  ReglaAscenso,
  SimularImpactoPayload,
} from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

type ModalKind = 'editor' | 'desactivar' | 'versiones' | null;

/**
 * La escala de la fuerza: una columna por escalafón y un escalón por tramo. Los
 * tramos sin regla se muestran vacíos, para que se note lo que falta cargar.
 */
@Component({
  selector: 'app-reglas-page',
  standalone: false,
  templateUrl: './reglas-page.html',
  styleUrl: './reglas-page.scss',
})
export class ReglasPage implements OnInit {
  private readonly svc = inject(AscensosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly escalera = signal<EscaleraReglas | null>(null);
  readonly cursos = signal<CursoDelCatalogo[]>([]);

  readonly modal = signal<ModalKind>(null);
  readonly escalonEnEdicion = signal<EscalonRegla | null>(null);
  readonly reglaSeleccionada = signal<ReglaAscenso | null>(null);
  readonly procesando = signal(false);

  readonly impacto = signal<ImpactoRegla | null>(null);
  readonly calculandoImpacto = signal(false);

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('reglas_ascenso.gestionar'));

  readonly stats = computed(() => this.escalera()?.stats ?? null);

  ngOnInit(): void {
    this.cargar();
    this.svc.getCursosDelCatalogo().subscribe({
      next: (c) => this.cursos.set(c),
      error: () => this.cursos.set([]),
    });
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getEscalera({ incluirInactivas: true, incluirVersiones: true }).subscribe({
      next: (e) => {
        this.escalera.set(e);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(parseError(err));
      },
    });
  }

  // ─── Presentación ─────────────────────────────────────────────────────────

  /** "2 años", "2 años y 6 meses", "6 meses". */
  tiempoLegible(regla: ReglaAscenso): string {
    const partes: string[] = [];
    if (regla.anios > 0) partes.push(`${regla.anios} ${regla.anios === 1 ? 'año' : 'años'}`);
    if (regla.meses > 0) partes.push(`${regla.meses} ${regla.meses === 1 ? 'mes' : 'meses'}`);
    return partes.length > 0 ? partes.join(' y ') : `${regla.dias_minimos} días`;
  }

  edadLegible(regla: ReglaAscenso): string {
    return regla.edad_maxima == null ? 'sin tope de edad' : `menor de ${regla.edad_maxima}`;
  }

  /** "solo si es mutado o tiene nivel liceal", para el chip del requisito. */
  condicionLegible(aplicaSi: string[]): string | null {
    if (!aplicaSi?.length || aplicaSi.includes('SIEMPRE')) return null;
    const etiquetas: Record<string, string> = {
      ES_MUTADO: 'es mutado',
      NO_ES_MUTADO: 'no es mutado',
      EGRESADO_ETA: 'egresó de la ETA',
      NO_EGRESADO_ETA: 'no egresó de la ETA',
      NIVEL_LICEAL: 'tiene nivel liceal',
    };
    const partes = aplicaSi.map((c) => etiquetas[c] ?? c);
    return `solo si ${partes.join(' o ')}`;
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────

  abrirEditor(escalon: EscalonRegla): void {
    this.impacto.set(null);
    this.escalonEnEdicion.set(escalon);
    this.modal.set('editor');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.escalonEnEdicion.set(null);
    this.reglaSeleccionada.set(null);
    this.impacto.set(null);
  }

  /** Simula el cambio sin guardarlo. */
  verImpacto(payload: SimularImpactoPayload): void {
    const regla = this.escalonEnEdicion()?.regla;
    if (!regla) return;

    this.calculandoImpacto.set(true);
    this.svc.simularImpacto(regla.id, payload).subscribe({
      next: (res) => {
        this.impacto.set(res);
        this.calculandoImpacto.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.calculandoImpacto.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  guardarRegla(payload: CrearReglaPayload | EditarReglaPayload): void {
    const escalon = this.escalonEnEdicion();
    if (!escalon) return;

    this.procesando.set(true);
    const peticion = escalon.regla
      ? this.svc.editarRegla(escalon.regla.id, payload as EditarReglaPayload)
      : this.svc.crearRegla(payload as CrearReglaPayload);

    peticion.subscribe({
      next: () => {
        this.procesando.set(false);
        this.cerrarModal();
        this.toast.success(
          escalon.regla
            ? 'Se guardó una versión nueva de la regla'
            : 'Regla creada correctamente',
        );
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  pedirDesactivar(regla: ReglaAscenso): void {
    this.reglaSeleccionada.set(regla);
    this.modal.set('desactivar');
  }

  confirmarDesactivar(): void {
    const regla = this.reglaSeleccionada();
    if (!regla) return;

    this.procesando.set(true);
    this.svc.desactivarRegla(regla.id).subscribe({
      next: () => {
        this.procesando.set(false);
        this.cerrarModal();
        this.toast.success(`La regla "${regla.nombre}" quedó desactivada`);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.procesando.set(false);
        this.toast.error(parseError(err));
      },
    });
  }

  activar(regla: ReglaAscenso): void {
    this.svc.activarRegla(regla.id).subscribe({
      next: () => {
        this.toast.success(`La regla "${regla.nombre}" volvió a estar activa`);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => this.toast.error(parseError(err)),
    });
  }

  /** Un tramo que nunca tuvo regla de la FAU no está «modificado»: se cargó acá. */
  etiquetaOrigen(regla: ReglaAscenso): string {
    if (regla.es_por_defecto) return 'Regla FAU';
    return regla.versiones_anteriores?.length ? 'Modificada' : 'Actualizada manualmente';
  }

  verVersiones(regla: ReglaAscenso): void {
    this.reglaSeleccionada.set(regla);
    this.modal.set('versiones');
  }
}
