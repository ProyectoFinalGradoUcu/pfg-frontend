import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MisionesService } from '../../../../core/services/misiones.service';
import { PersonalService, PersonaListItem } from '../../../../core/services/personal.service';
import { Convocatoria, MisionDefinicion } from '../../../../core/models/misiones.models';

type ModalKind = 'nuevaConvocatoria' | 'editarConvocatoria' | 'confirmarEliminar' | null;
type EstadoFiltro = '' | 'activa' | 'finalizada';

@Component({
  selector: 'app-mision-convocatorias-page',
  standalone: false,
  templateUrl: './mision-convocatorias-page.html',
  styleUrl: './mision-convocatorias-page.scss',
})
export class MisionConvocatoriasPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly misionesService = inject(MisionesService);
  private readonly personalService = inject(PersonalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private misionId = '';

  readonly mision = signal<MisionDefinicion | null>(null);
  readonly loading = signal(false);
  readonly loadingConvocatorias = signal(false);
  readonly guardando = signal(false);
  readonly modal = signal<ModalKind>(null);
  readonly modalError = signal<string | null>(null);
  readonly convocatoriaSeleccionada = signal<Convocatoria | null>(null);
  readonly personal = signal<PersonaListItem[]>([]);

  readonly convocatorias = signal<Convocatoria[]>([]);
  readonly convPage = signal(1);
  readonly convPageSize = 10;
  readonly convTotal = signal(0);

  readonly filtroOrdenBoletin = signal('');
  readonly filtroEstado = signal<EstadoFiltro>('');
  readonly hayFiltrosConv = computed(() => !!this.filtroOrdenBoletin() || !!this.filtroEstado());
  private readonly filtroSubject = new Subject<void>();

  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  readonly puedeGestionar = computed(() => this.auth.hasPermiso('misiones.gestionar'));

  readonly convocatoriaForm = this.fb.group({
    numero_orden: [''],
    boletin: [''],
    fecha_salida: [''],
    fecha_llegada: [''],
    observaciones: [''],
    persona_ids: [[] as string[]],
  });

  ngOnInit(): void {
    this.misionId = this.route.snapshot.paramMap.get('misionId')!;
    this.cargarMision();
    this.cargarConvocatorias();
    this.personalService.findAll().subscribe({ next: (p) => this.personal.set(p) });

    this.filtroSubject.pipe(debounceTime(350)).subscribe(() => {
      this.convPage.set(1);
      this.cargarConvocatorias(1);
    });
  }

  ngOnDestroy(): void {
    this.filtroSubject.complete();
  }

  cargarMision(): void {
    this.loading.set(true);
    this.misionesService.findDefinicionById(this.misionId).subscribe({
      next: (m) => {
        this.mision.set(m);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
        this.router.navigate(['/misiones/catalogo']);
      },
    });
  }

  cargarConvocatorias(page = this.convPage()): void {
    this.loadingConvocatorias.set(true);
    const finalizada = this.filtroEstado() === '' ? undefined : this.filtroEstado() === 'finalizada';
    this.misionesService
      .findConvocatorias(this.misionId, page, this.convPageSize, this.filtroOrdenBoletin().trim() || undefined, finalizada)
      .subscribe({
        next: (res) => {
          this.convocatorias.set(res.items);
          this.convTotal.set(res.total);
          this.convPage.set(res.page);
          this.loadingConvocatorias.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
          this.loadingConvocatorias.set(false);
        },
      });
  }

  onConvPageChange(page: number): void {
    this.convPage.set(page);
    this.cargarConvocatorias(page);
  }

  onOrdenBoletinInput(value: string): void {
    this.filtroOrdenBoletin.set(value);
    this.filtroSubject.next();
  }

  onEstadoFiltroChange(value: string): void {
    this.filtroEstado.set(value as EstadoFiltro);
    this.filtroSubject.next();
  }

  limpiarFiltrosConv(): void {
    this.filtroOrdenBoletin.set('');
    this.filtroEstado.set('');
    this.convPage.set(1);
    this.cargarConvocatorias(1);
  }

  volver(): void {
    this.router.navigate(['/misiones/catalogo']);
  }

  verFuncionarios(convocatoria: Convocatoria): void {
    this.cerrarMenu();
    this.router.navigate(['/misiones/catalogo', this.misionId, 'convocatorias', convocatoria.id]);
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

  abrirNuevaConvocatoria(): void {
    this.convocatoriaForm.reset({
      numero_orden: '',
      boletin: '',
      fecha_salida: '',
      fecha_llegada: '',
      observaciones: '',
      persona_ids: [],
    });
    this.modalError.set(null);
    this.convocatoriaSeleccionada.set(null);
    this.modal.set('nuevaConvocatoria');
  }

  abrirEditar(convocatoria: Convocatoria): void {
    this.cerrarMenu();
    this.convocatoriaSeleccionada.set(convocatoria);
    this.convocatoriaForm.reset({
      numero_orden: convocatoria.numero_orden ?? '',
      boletin: convocatoria.boletin ?? '',
      fecha_salida: convocatoria.fecha_salida ?? '',
      fecha_llegada: convocatoria.fecha_llegada ?? '',
      observaciones: convocatoria.observaciones ?? '',
      persona_ids: [],
    });
    this.modalError.set(null);
    this.modal.set('editarConvocatoria');
  }

  eliminarConvocatoria(convocatoria: Convocatoria): void {
    this.cerrarMenu();
    this.convocatoriaSeleccionada.set(convocatoria);
    this.modalError.set(null);
    this.modal.set('confirmarEliminar');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
    this.convocatoriaSeleccionada.set(null);
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  guardarConvocatoria(): void {
    const raw = this.convocatoriaForm.getRawValue();

    if (!raw.numero_orden?.trim() && !raw.boletin?.trim()) {
      this.modalError.set('Debés ingresar al menos el N° de orden o el boletín.');
      return;
    }

    const editando = this.convocatoriaSeleccionada();

    this.modalError.set(null);
    this.guardando.set(true);

    if (editando) {
      this.misionesService
        .editarConvocatoria(this.misionId, editando.id, {
          numero_orden: raw.numero_orden || undefined,
          boletin: raw.boletin || undefined,
          fecha_salida: raw.fecha_salida || undefined,
          fecha_llegada: raw.fecha_llegada || undefined,
          observaciones: raw.observaciones || undefined,
        })
        .subscribe({
          next: () => {
            this.guardando.set(false);
            this.cerrarModal();
            this.toast.success('Convocatoria actualizada correctamente');
            this.cargarConvocatorias();
          },
          error: (err: HttpErrorResponse) => {
            this.guardando.set(false);
            this.modalError.set(this.parseError(err));
          },
        });
      return;
    }

    const personaIds = (raw.persona_ids ?? []).map((id) => Number(id));
    this.misionesService
      .crearConvocatoria(this.misionId, {
        numero_orden: raw.numero_orden || undefined,
        boletin: raw.boletin || undefined,
        fecha_salida: raw.fecha_salida || undefined,
        fecha_llegada: raw.fecha_llegada || undefined,
        observaciones: raw.observaciones || undefined,
        persona_ids: personaIds.length > 0 ? personaIds : undefined,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          this.toast.success('Convocatoria creada correctamente');
          this.cargarConvocatorias(1);
          this.cargarMision();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.modalError.set(this.parseError(err));
        },
      });
  }

  confirmarEliminar(): void {
    const convocatoria = this.convocatoriaSeleccionada();
    if (!convocatoria) return;
    this.misionesService.eliminarConvocatoria(this.misionId, convocatoria.id).subscribe({
      next: () => {
        if (this.convocatorias().length === 1 && this.convPage() > 1) {
          this.convPage.update((p) => p - 1);
        }
        this.cargarConvocatorias();
        this.cargarMision();
        this.toast.success('Convocatoria eliminada');
        this.cerrarModal();
      },
      error: (err: HttpErrorResponse) => this.modalError.set(this.parseError(err)),
    });
  }

  trackConvocatoria = (_: number, c: Convocatoria) => c.id;

  private parseError(err: HttpErrorResponse): string {
    const body = err.error;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (Array.isArray(body?.message) && body.message.length) return body.message[0];
    if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();
    return (
      err.error?.service_response?.service_status?.http_message ??
      (err.status === 404 ? 'El recurso no fue encontrado.' : null) ??
      (err.status === 403 ? 'No tenés permiso para realizar esta acción.' : null) ??
      (err.status === 0 ? 'No se pudo conectar con el servidor.' : null) ??
      'Ocurrió un error inesperado. Intentá de nuevo.'
    );
  }
}
