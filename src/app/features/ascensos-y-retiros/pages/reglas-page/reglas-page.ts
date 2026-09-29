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
  GrupoEscalera,
  ImpactoRegla,
  ReglaAscenso,
  SimularImpactoPayload,
} from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

type ModalKind = 'editor' | 'versiones' | null;

/**
 * La escala de la fuerza, un escalafón a la vez: tabs arriba, reglas en
 * acordeón adentro. Evita que los escalafones sin reglas definidas compitan
 * visualmente con el que sí tiene contenido.
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

  readonly activeTab = signal<string | null>(null);
  /** La última regla guardada queda expandida para que se vea el resultado. */
  readonly reglaRecienGuardada = signal<string | null>(null);

  readonly modal = signal<ModalKind>(null);
  readonly escalonEnEdicion = signal<EscalonRegla | null>(null);
  readonly escalonesParaAlta = signal<EscalonRegla[]>([]);
  readonly reglaSeleccionada = signal<ReglaAscenso | null>(null);
  readonly procesando = signal(false);

  /** El foco vuelve acá cuando se cierra el modal, como pide accesibilidad. */
  private elementoDisparador: HTMLElement | null = null;

  readonly impacto = signal<ImpactoRegla | null>(null);
  readonly calculandoImpacto = signal(false);

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('reglas_ascenso.gestionar'));

  readonly stats = computed(() => this.escalera()?.stats ?? null);

  readonly grupoActivo = computed<GrupoEscalera | null>(() => {
    const grupos = this.escalera()?.grupos ?? [];
    return grupos.find((g) => g.clave === this.activeTab()) ?? grupos[0] ?? null;
  });

  /** Los tramos que todavía no tienen regla: lo único que se puede dar de alta. */
  readonly escalonesSinRegla = computed(
    () => this.grupoActivo()?.escalones.filter((e) => !e.regla) ?? [],
  );

  ngOnInit(): void {
    this.cargar();
    this.svc.getCursosDelCatalogo().subscribe({
      next: (c) => this.cursos.set(c),
      error: () => this.cursos.set([]),
    });
  }

  switchTab(clave: string): void {
    this.activeTab.set(clave);
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getEscalera({ incluirInactivas: true, incluirVersiones: true }).subscribe({
      next: (e) => {
        this.escalera.set(e);
        this.loading.set(false);
        if (this.activeTab() == null) {
          this.activeTab.set(e.grupos.find((g) => g.clave === 'OFICIALES')?.clave ?? e.grupos[0]?.clave ?? null);
        }
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

  /** Etiqueta fija del requisito de antigüedad, sin importar lo que diga `descripcion`. */
  reqLabel(req: { tipo: string; descripcion: string; anios_antiguedad: number | null }): string {
    if (req.tipo === 'ANTIGUEDAD_SERVICIO') {
      const y = req.anios_antiguedad ?? 0;
      return `Antigüedad de servicio: requiere ${y} ${y === 1 ? 'año' : 'años'}`;
    }
    return req.descripcion || '(sin definir)';
  }

  /** Texto de procedencia al pie de la card. */
  provenance(regla: ReglaAscenso): string {
    if (!regla.activo) {
      return `Desactivada el ${this.fechaLegible(regla.actualizado_en)} · pendiente de revisión`;
    }
    let base = regla.es_por_defecto ? 'Regla propia de la FAU' : 'Regla editada manualmente, no sigue el criterio general de la FAU';
    base += ` · última edición ${this.fechaLegible(regla.actualizado_en)}`;
    return base;
  }

  private fechaLegible(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────

  /** Editar una regla existente, o dar de alta un tramo puntual sin regla. */
  abrirEditor(escalon: EscalonRegla): void {
    this.elementoDisparador = document.activeElement as HTMLElement;
    this.impacto.set(null);
    this.escalonEnEdicion.set(escalon);
    this.escalonesParaAlta.set(escalon.regla ? [] : [escalon]);
    this.modal.set('editor');
  }

  /** "+ Nueva regla": alta libre entre los tramos sin regla del escalafón activo. */
  abrirNuevaRegla(): void {
    const disponibles = this.escalonesSinRegla();
    if (!disponibles.length) return;
    this.elementoDisparador = document.activeElement as HTMLElement;
    this.impacto.set(null);
    this.escalonEnEdicion.set(disponibles[0]);
    this.escalonesParaAlta.set(disponibles);
    this.modal.set('editor');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.escalonEnEdicion.set(null);
    this.escalonesParaAlta.set([]);
    this.reglaSeleccionada.set(null);
    this.impacto.set(null);
    this.elementoDisparador?.focus();
    this.elementoDisparador = null;
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
      next: (guardada) => {
        this.procesando.set(false);
        this.reglaRecienGuardada.set(guardada.id);
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

  /** Instantáneo, sin modal de confirmación: el badge cambia al toque. */
  desactivar(regla: ReglaAscenso): void {
    this.svc.desactivarRegla(regla.id).subscribe({
      next: () => {
        this.toast.success(`La regla "${regla.nombre}" quedó desactivada`);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => this.toast.error(parseError(err)),
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

  verVersiones(regla: ReglaAscenso): void {
    this.elementoDisparador = document.activeElement as HTMLElement;
    this.reglaSeleccionada.set(regla);
    this.modal.set('versiones');
  }
}
