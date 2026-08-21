import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MisionesService } from '../../../../core/services/misiones.service';
import { PaisesService, PaisOpcion } from '../../../../core/services/paises.service';
import {
  FuncionarioConMisiones,
  FuncionarioMisionItem,
  MisionDefinicion,
  MisionesStats,
  MisionOpcion,
} from '../../../../core/models/misiones.models';

type TabKind = 'catalogo' | 'personal-en-mision';
type ModalKind =
  | 'nuevaMision'
  | 'editarMision'
  | 'confirmarEliminar'
  | 'confirmarQuitarPersonal'
  | 'editarFuncionarioPersonal'
  | null;
type EstadoFiltro = '' | 'activa' | 'finalizada';

interface FilaPersonal {
  funcionarioId: string;
  cedula: string;
  nombre: string;
  mision: FuncionarioMisionItem;
}

@Component({
  selector: 'app-misiones-page',
  standalone: false,
  templateUrl: './misiones-page.html',
  styleUrl: './misiones-page.scss',
})
export class MisionesPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly misionesService = inject(MisionesService);
  private readonly paisesService = inject(PaisesService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly tab = signal<TabKind>('catalogo');
  readonly modal = signal<ModalKind>(null);
  readonly modalError = signal<string | null>(null);

  // ── Catálogo ─────────────────────────────────────────────────────────────
  readonly loadingDef = signal(false);
  readonly definiciones = signal<MisionDefinicion[]>([]);
  readonly stats = signal<MisionesStats>({
    total_misiones: 0,
    convocatorias_activas: 0,
    personal_desplegado: 0,
  });
  readonly defPage = signal(1);
  readonly defPageSize = 10;
  readonly defTotal = signal(0);
  readonly misionSeleccionada = signal<MisionDefinicion | null>(null);
  readonly guardando = signal(false);
  readonly paises = signal<PaisOpcion[]>([]);

  readonly filtroNombre = signal('');
  readonly filtroPais = signal('');
  readonly hayFiltrosDef = computed(() => !!this.filtroNombre() || !!this.filtroPais());
  private readonly defTextSubject = new Subject<void>();

  // ── Personal en misión ───────────────────────────────────────────────────
  readonly loadingPersonal = signal(false);
  readonly funcionarios = signal<FuncionarioConMisiones[]>([]);
  readonly misionesOpciones = signal<MisionOpcion[]>([]);
  readonly personalPage = signal(1);
  readonly personalPageSize = 10;
  readonly filaAQuitar = signal<FilaPersonal | null>(null);
  readonly quitando = signal(false);
  readonly filaEditando = signal<FilaPersonal | null>(null);
  readonly guardandoFuncionarioPersonal = signal(false);

  readonly busquedaPersonal = signal('');
  readonly misionesFiltroIds = signal<string[]>([]);
  readonly ordenBoletinFiltroPersonal = signal('');
  readonly estadoFiltroPersonal = signal<EstadoFiltro>('');
  readonly hayFiltrosPersonal = computed(
    () =>
      !!this.busquedaPersonal() ||
      this.misionesFiltroIds().length > 0 ||
      !!this.ordenBoletinFiltroPersonal() ||
      !!this.estadoFiltroPersonal(),
  );

  readonly filasFlat = computed<FilaPersonal[]>(() => {
    const q = this.busquedaPersonal().trim().toLowerCase();
    const orden = this.ordenBoletinFiltroPersonal().trim().toLowerCase();
    const misionIds = this.misionesFiltroIds();
    const estado = this.estadoFiltroPersonal();

    return this.funcionarios().flatMap((f) =>
      f.misiones
        .filter((m) => {
          if (q && !(f.cedula.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q))) return false;
          if (misionIds.length > 0 && !misionIds.includes(m.id)) return false;
          if (
            orden &&
            !((m.numero_orden ?? '').toLowerCase().includes(orden) || (m.boletin ?? '').toLowerCase().includes(orden))
          ) {
            return false;
          }
          if (estado === 'activa' && m.finalizada) return false;
          if (estado === 'finalizada' && !m.finalizada) return false;
          return true;
        })
        .map((m) => ({ funcionarioId: f.id, cedula: f.cedula, nombre: f.nombre, mision: m })),
    );
  });

  readonly filasPaginadas = computed<FilaPersonal[]>(() => {
    const start = (this.personalPage() - 1) * this.personalPageSize;
    return this.filasFlat().slice(start, start + this.personalPageSize);
  });

  // ── Menú de acciones (kebab) ─────────────────────────────────────────────
  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  // ── Permisos ─────────────────────────────────────────────────────────────
  readonly puedeGestionar = computed(() => this.auth.hasPermiso('misiones.gestionar'));

  // ── Formularios ──────────────────────────────────────────────────────────
  readonly misionForm = this.fb.group({
    nombre_mision: ['', [Validators.required, Validators.maxLength(150)]],
    pais: ['', Validators.required],
  });

  readonly editarFuncionarioForm = this.fb.group({
    numero_orden: [''],
    boletin: [''],
    observaciones: [''],
  });

  ngOnInit(): void {
    const section = this.route.snapshot.data['section'] as TabKind;
    if (section) this.tab.set(section);

    this.paisesService.getPaises().subscribe((p) => this.paises.set(p));

    if (this.tab() === 'catalogo') {
      this.cargarDefiniciones();
    } else {
      this.cargarPersonal();
      this.misionesService.findMisionesOpciones().subscribe((m) => this.misionesOpciones.set(m));
    }

    this.defTextSubject.pipe(debounceTime(350)).subscribe(() => {
      this.defPage.set(1);
      this.cargarDefiniciones();
    });
  }

  ngOnDestroy(): void {
    this.defTextSubject.complete();
  }

  // ── Carga ────────────────────────────────────────────────────────────────

  cargarDefiniciones(): void {
    this.loadingDef.set(true);
    this.misionesService
      .findAllDefiniciones(
        this.defPage(),
        this.defPageSize,
        this.filtroNombre().trim() || undefined,
        this.filtroPais().trim() || undefined,
      )
      .subscribe({
        next: (res) => {
          this.definiciones.set(res.items);
          this.defTotal.set(res.total);
          this.stats.set(res.stats);
          this.loadingDef.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
          this.loadingDef.set(false);
        },
      });
  }

  cargarPersonal(): void {
    this.loadingPersonal.set(true);
    this.misionesService
      .findFuncionariosConMisiones()
      .pipe(catchError(() => of([])))
      .subscribe((funcionarios) => {
        this.funcionarios.set(funcionarios);
        this.loadingPersonal.set(false);
      });
  }

  onNombreInput(value: string): void {
    this.filtroNombre.set(value);
    this.defTextSubject.next();
  }

  onPaisInput(value: string): void {
    this.filtroPais.set(value);
    this.defTextSubject.next();
  }

  limpiarFiltrosDef(): void {
    this.filtroNombre.set('');
    this.filtroPais.set('');
    this.defPage.set(1);
    this.cargarDefiniciones();
  }

  onDefPageChange(page: number): void {
    this.defPage.set(page);
    this.cargarDefiniciones();
  }

  onBusquedaPersonalInput(value: string): void {
    this.busquedaPersonal.set(value);
    this.personalPage.set(1);
  }

  onMisionFiltroChange(value: string[] | null): void {
    this.misionesFiltroIds.set(value ?? []);
    this.personalPage.set(1);
  }

  onOrdenBoletinPersonalInput(value: string): void {
    this.ordenBoletinFiltroPersonal.set(value);
    this.personalPage.set(1);
  }

  onEstadoFiltroPersonalChange(value: string): void {
    this.estadoFiltroPersonal.set(value as EstadoFiltro);
    this.personalPage.set(1);
  }

  limpiarFiltrosPersonal(): void {
    this.busquedaPersonal.set('');
    this.misionesFiltroIds.set([]);
    this.ordenBoletinFiltroPersonal.set('');
    this.estadoFiltroPersonal.set('');
    this.personalPage.set(1);
  }

  // ── Navegación ───────────────────────────────────────────────────────────

  verConvocatorias(mision: MisionDefinicion): void {
    this.cerrarMenu();
    this.router.navigate(['/misiones/catalogo', mision.id]);
  }

  // ── Menú de acciones (kebab) ─────────────────────────────────────────────

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuId() === id) {
      this.cerrarMenu();
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.menuPosition.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      this.openMenuId.set(id);
    }
  }

  cerrarMenu(): void {
    this.openMenuId.set(null);
    this.menuPosition.set(null);
  }

  // ── Modales ──────────────────────────────────────────────────────────────

  abrirNuevaMision(): void {
    this.misionForm.reset({ nombre_mision: '', pais: '' });
    this.modalError.set(null);
    this.misionSeleccionada.set(null);
    this.modal.set('nuevaMision');
  }

  abrirEditar(mision: MisionDefinicion): void {
    this.cerrarMenu();
    this.misionSeleccionada.set(mision);
    this.misionForm.reset({ nombre_mision: mision.nombre_mision, pais: mision.pais });
    this.modalError.set(null);
    this.modal.set('editarMision');
  }

  eliminarMision(mision: MisionDefinicion): void {
    this.cerrarMenu();
    this.misionSeleccionada.set(mision);
    this.modalError.set(null);
    this.modal.set('confirmarEliminar');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
    this.misionSeleccionada.set(null);
    this.filaAQuitar.set(null);
    this.filaEditando.set(null);
  }

  filaKey(fila: FilaPersonal): string {
    return `${fila.funcionarioId}-${fila.mision.convocatoriaId}`;
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  guardarMision(): void {
    if (this.misionForm.invalid) {
      this.misionForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
      return;
    }

    const raw = this.misionForm.getRawValue();
    const payload = { nombre_mision: raw.nombre_mision!, pais: raw.pais! };

    this.modalError.set(null);
    this.guardando.set(true);

    const editando = this.misionSeleccionada();

    if (editando) {
      this.misionesService.editarDefinicion(editando.id, payload).subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          this.toast.success('Misión actualizada correctamente');
          this.cargarDefiniciones();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.modalError.set(this.parseError(err));
        },
      });
    } else {
      this.misionesService.createDefinicion(payload).subscribe({
        next: (nueva) => {
          this.guardando.set(false);
          this.cerrarModal();
          this.toast.success(`Misión "${nueva.nombre_mision}" creada correctamente`);
          this.cargarDefiniciones();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.modalError.set(this.parseError(err));
        },
      });
    }
  }

  confirmarEliminar(): void {
    const mision = this.misionSeleccionada();
    if (!mision) return;
    this.misionesService.deleteDefinicion(mision.id).subscribe({
      next: () => {
        if (this.definiciones().length === 1 && this.defPage() > 1) {
          this.defPage.update((p) => p - 1);
        }
        this.cargarDefiniciones();
        this.toast.success(`Misión "${mision.nombre_mision}" eliminada`);
        this.cerrarModal();
      },
      error: (err: HttpErrorResponse) => this.modalError.set(this.parseError(err)),
    });
  }

  abrirConfirmQuitarPersonal(fila: FilaPersonal): void {
    this.filaAQuitar.set(fila);
    this.modalError.set(null);
    this.modal.set('confirmarQuitarPersonal');
  }

  confirmarQuitarPersonal(): void {
    const fila = this.filaAQuitar();
    if (!fila) return;
    this.quitando.set(true);
    this.misionesService.deleteFuncionario(fila.mision.id, fila.mision.convocatoriaId, fila.funcionarioId).subscribe({
      next: () => {
        this.quitando.set(false);
        this.toast.success('Funcionario removido de la convocatoria');
        this.cerrarModal();
        this.cargarPersonal();
      },
      error: (err: HttpErrorResponse) => {
        this.quitando.set(false);
        this.toast.error(this.parseError(err));
      },
    });
  }

  abrirEditarFuncionarioPersonal(fila: FilaPersonal): void {
    this.cerrarMenu();
    this.filaEditando.set(fila);
    this.editarFuncionarioForm.reset({
      numero_orden: fila.mision.numero_orden ?? '',
      boletin: fila.mision.boletin ?? '',
      observaciones: fila.mision.observaciones ?? '',
    });
    this.modalError.set(null);
    this.modal.set('editarFuncionarioPersonal');
  }

  guardarEdicionFuncionarioPersonal(): void {
    const fila = this.filaEditando();
    if (!fila) return;

    const raw = this.editarFuncionarioForm.getRawValue();
    if (!raw.numero_orden?.trim() && !raw.boletin?.trim()) {
      this.modalError.set('Debés ingresar al menos el N° de orden o el boletín.');
      return;
    }

    const payload = {
      numero_orden: raw.numero_orden || undefined,
      boletin: raw.boletin || undefined,
      observaciones: raw.observaciones || undefined,
    };

    this.modalError.set(null);
    this.guardandoFuncionarioPersonal.set(true);
    this.misionesService
      .updateFuncionario(fila.mision.id, fila.mision.convocatoriaId, fila.funcionarioId, payload)
      .subscribe({
        next: () => {
          this.guardandoFuncionarioPersonal.set(false);
          this.cerrarModal();
          this.toast.success('Funcionario actualizado correctamente');
          this.cargarPersonal();
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoFuncionarioPersonal.set(false);
          this.modalError.set(this.parseError(err));
        },
      });
  }

  trackDefinicion = (_: number, d: MisionDefinicion) => d.id;
  trackFila = (_: number, f: FilaPersonal) => `${f.funcionarioId}-${f.mision.convocatoriaId}`;

  private parseError(err: HttpErrorResponse): string {
    const body = err.error;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (Array.isArray(body?.message) && body.message.length) return body.message[0];
    if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();
    return (
      err.error?.service_response?.service_status?.http_message ??
      (err.status === 409 ? 'Ya existe una misión con ese nombre.' : null) ??
      (err.status === 404 ? 'El recurso no fue encontrado.' : null) ??
      (err.status === 403 ? 'No tenés permiso para realizar esta acción.' : null) ??
      (err.status === 0 ? 'No se pudo conectar con el servidor.' : null) ??
      'Ocurrió un error inesperado. Intentá de nuevo.'
    );
  }
}
