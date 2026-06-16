import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CursosService } from '../../../../core/services/cursos.service';
import { PersonalService, PersonaListItem } from '../../../../core/services/personal.service';
import {
  CursoDefinicion,
  CursoFuncionarioItem,
  EstadoCurso,
  FuncionarioConCursos,
  HistorialCurso,
  ModuloCurso,
  TipoCurso,
} from '../../../../core/models/cursos.models';

type TabKind = 'inscripciones' | 'catalogo';
type ModalKind =
  | 'registrarCurso'
  | 'nuevoCurso'
  | 'modulos'
  | 'designar'
  | 'editar'
  | 'calificacionMasiva'
  | null;

interface FilaHistorial {
  funcionarioId: string;
  cedula: string;
  nombre: string;
  curso: CursoFuncionarioItem;
}

@Component({
  selector: 'app-cursos-page',
  standalone: false,
  templateUrl: './cursos-page.html',
  styleUrl: './cursos-page.scss',
})
export class CursosPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cursosService = inject(CursosService);
  private readonly personalService = inject(PersonalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  // ── Estado general ─────────────────────────────────────────────────────────
  readonly tab = signal<TabKind>('inscripciones');
  readonly loading = signal(false);
  readonly modal = signal<ModalKind>(null);
  readonly modalError = signal<string | null>(null);

  // ── Historial ──────────────────────────────────────────────────────────────
  readonly funcionarios = signal<FuncionarioConCursos[]>([]);
  readonly cedulaFiltro = signal('');
  readonly buscandoCedula = signal(false);
  readonly personal = signal<PersonaListItem[]>([]);
  readonly historialPage = signal(1);
  readonly historialPageSize = 10;
  readonly archivoCertificado = signal<File | null>(null);
  readonly dragOver = signal(false);

  private readonly cedulaSubject = new Subject<string>();

  // ── Gestión ────────────────────────────────────────────────────────────────
  readonly definiciones      = signal<CursoDefinicion[]>([]);
  readonly defPage           = signal(1);
  readonly defPageSize       = 10;
  readonly defTotal          = signal(0);
  readonly loadingDef        = signal(false);
  readonly cursoSeleccionado = signal<CursoDefinicion | null>(null);
  readonly guardandoModulo   = signal(false);

  // ── Filtros gestión ────────────────────────────────────────────────────────
  readonly filtroNombre      = signal('');
  readonly filtroInstitucion = signal('');
  readonly filtroTipo        = signal<'' | 'true' | 'false'>('');
  readonly hayFiltrosDef     = computed(
    () => !!this.filtroNombre() || !!this.filtroInstitucion() || !!this.filtroTipo(),
  );
  private readonly defTextSubject = new Subject<void>();

  // ── Menú de acciones (kebab) ────────────────────────────────────────────────
  readonly openMenuId = signal<string | null>(null);
  readonly menuPosition = signal<{ top: number; right: number } | null>(null);

  // ── Calificaciones (individual) ───────────────────────────────────────────
  readonly calificandoId         = signal<string | null>(null);
  readonly calificacionValor     = signal<number>(10);
  readonly guardandoCalificacion = signal(false);

  // ── Calificación masiva ────────────────────────────────────────────────────
  readonly cursoMasivoId        = signal<string | null>(null);
  readonly calificacionesMasivas = signal<Record<string, number>>({});
  readonly guardandoMasivo       = signal(false);

  readonly cursosAptos = computed(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vistos = new Set<string>();
    const result: { id: string; nombre: string; institucion: string }[] = [];
    for (const fila of this.filasFlat()) {
      if (!fila.curso.fechaFin) continue;
      if (new Date(fila.curso.fechaFin) >= hoy) continue;
      if (fila.curso.calificacion !== null) continue;
      if (vistos.has(fila.curso.id)) continue;
      vistos.add(fila.curso.id);
      result.push({ id: fila.curso.id, nombre: fila.curso.nombre_curso, institucion: fila.curso.institucion });
    }
    return result;
  });

  readonly filasCursoMasivo = computed<FilaHistorial[]>(() => {
    const id = this.cursoMasivoId();
    if (!id) return [];
    return this.filasFlat().filter((f) => f.curso.id === id && f.curso.calificacion === null);
  });

  // ── Designar ────────────────────────────────────────────────────────────────
  readonly designando = signal(false);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly puedeGestionar = computed(() => this.auth.hasPermiso('cursos.gestionar'));
  // definicionesPaginadas eliminado: paginación server-side via cargarDefiniciones()

  readonly filasFlat = computed<FilaHistorial[]>(() =>
    this.funcionarios().flatMap((f) =>
      f.cursos.map((c) => ({
        funcionarioId: f.id,
        cedula: f.cedula,
        nombre: f.nombre,
        curso: c,
      })),
    ),
  );

  readonly completados = computed(
    () => this.filasFlat().filter((f) => f.curso.calificacion !== null).length,
  );
  readonly enCurso = computed(
    () => this.filasFlat().filter((f) => f.curso.calificacion === null).length,
  );
  readonly obligatorios = computed(
    () => this.filasFlat().filter((f) => f.curso.tipo === 'obligatorio').length,
  );

  readonly filasPaginadas = computed<FilaHistorial[]>(() => {
    const start = (this.historialPage() - 1) * this.historialPageSize;
    return this.filasFlat().slice(start, start + this.historialPageSize);
  });

  // ── Opciones ───────────────────────────────────────────────────────────────
  readonly tipoOpciones: { value: TipoCurso; label: string }[] = [
    { value: 'obligatorio', label: 'Obligatorio' },
    { value: 'optativo', label: 'Optativo' },
  ];

  readonly estadoOpciones: { value: EstadoCurso; label: string }[] = [
    { value: 'en_curso', label: 'En Curso' },
    { value: 'completado', label: 'Completado' },
  ];

  // ── Formularios ────────────────────────────────────────────────────────────
  readonly registrarForm = this.fb.group({
    personaId: ['', Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    institucion: ['', [Validators.required, Validators.maxLength(100)]],
    tipo: ['' as TipoCurso | '', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    estado: ['' as EstadoCurso | '', Validators.required],
  });

  readonly nuevoCursoForm = this.fb.group({
    nombre_curso: ['', [Validators.required, Validators.maxLength(150)]],
    institucion: ['', [Validators.required, Validators.maxLength(100)]],
    es_obligatorio: [false],
    // Designar ahora (toggle): si está activo, crea el curso y una primera designación.
    designar_ahora: [false],
    numero_orden: [''],
    boletin: [''],
    fecha_inicio: [''],
    fecha_fin: [''],
    persona_ids: [[] as string[]],
  });

  readonly moduloForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: [''],
  });

  readonly designarForm = this.fb.group({
    numero_orden: [''],
    boletin: [''],
    fecha_inicio: [''],
    fecha_fin: [''],
    persona_ids: [[] as string[], Validators.required],
    modulo_ids: [[] as string[]],
  });

  readonly editarForm = this.fb.group({
    nombre_curso: ['', [Validators.required, Validators.maxLength(150)]],
    institucion: ['', [Validators.required, Validators.maxLength(100)]],
    es_obligatorio: [false],
  });

  ngOnInit(): void {
    const section = this.route.snapshot.data['section'] as TabKind;
    if (section) this.tab.set(section);
    this.cargar();
    this.cargarDefiniciones();

    this.cedulaSubject
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((cedula) => {
          this.buscandoCedula.set(true);
          return this.cursosService
            .findFuncionariosConCursos(cedula || undefined)
            .pipe(catchError(() => of([])));
        }),
      )
      .subscribe((funcionarios) => {
        this.funcionarios.set(funcionarios);
        this.historialPage.set(1);
        this.buscandoCedula.set(false);
      });

    this.defTextSubject
      .pipe(debounceTime(350))
      .subscribe(() => {
        this.defPage.set(1);
        this.cargarDefiniciones();
      });
  }

  ngOnDestroy(): void {
    this.cedulaSubject.complete();
    this.defTextSubject.complete();
  }

  cargar(): void {
    this.loading.set(true);
    forkJoin({
      funcionarios: this.cursosService.findFuncionariosConCursos().pipe(catchError(() => of([]))),
      personal: this.personalService.findAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ funcionarios, personal }) => {
        this.funcionarios.set(funcionarios);
        this.personal.set(personal);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
      },
    });
  }

  cargarDefiniciones(): void {
    this.loadingDef.set(true);
    const tipo = this.filtroTipo();
    const esObligatorio = tipo === '' ? undefined : tipo === 'true';
    this.cursosService
      .findAllDefiniciones(
        this.defPage(),
        this.defPageSize,
        this.filtroNombre().trim() || undefined,
        this.filtroInstitucion().trim() || undefined,
        esObligatorio,
      )
      .pipe(catchError(() => of({ items: [] as CursoDefinicion[], total: 0, page: 1, pageSize: this.defPageSize })))
      .subscribe((res) => {
        this.definiciones.set(res.items);
        this.defTotal.set(res.total);
        this.loadingDef.set(false);
      });
  }

  onNombreInput(value: string): void {
    this.filtroNombre.set(value);
    this.defTextSubject.next();
  }

  onInstitucionInput(value: string): void {
    this.filtroInstitucion.set(value);
    this.defTextSubject.next();
  }

  onTipoFilterChange(value: string): void {
    this.filtroTipo.set(value as '' | 'true' | 'false');
    this.defPage.set(1);
    this.cargarDefiniciones();
  }

  limpiarFiltrosDef(): void {
    this.filtroNombre.set('');
    this.filtroInstitucion.set('');
    this.filtroTipo.set('');
    this.defPage.set(1);
    this.cargarDefiniciones();
  }

  onDefPageChange(page: number): void {
    this.defPage.set(page);
    this.cargarDefiniciones();
  }

  onCedulaInput(value: string): void {
    this.cedulaFiltro.set(value);
    this.cedulaSubject.next(value.trim());
  }

  limpiarCedula(): void {
    this.cedulaFiltro.set('');
    this.cedulaSubject.next('');
  }

  // ── Modales ────────────────────────────────────────────────────────────────

  abrirRegistrar(): void {
    this.registrarForm.reset({
      personaId: '', nombre: '', institucion: '', tipo: '', fechaInicio: '', fechaFin: '', estado: '',
    });
    this.archivoCertificado.set(null);
    this.modalError.set(null);
    this.modal.set('registrarCurso');
  }

  abrirNuevoCurso(): void {
    this.nuevoCursoForm.reset({
      nombre_curso: '', institucion: '', es_obligatorio: false,
      designar_ahora: false, numero_orden: '', boletin: '',
      fecha_inicio: '', fecha_fin: '', persona_ids: [],
    });
    this.modalError.set(null);
    this.modal.set('nuevoCurso');
  }

  abrirModulos(curso: CursoDefinicion): void {
    this.cerrarMenu();
    this.cursoSeleccionado.set(curso);
    this.moduloForm.reset({ nombre: '', descripcion: '' });
    this.modalError.set(null);
    this.modal.set('modulos');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.modalError.set(null);
    this.archivoCertificado.set(null);
    this.cursoSeleccionado.set(null);
  }

  // ── Menú de acciones (kebab) ────────────────────────────────────────────────

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

  // ── Designar / Dictar ───────────────────────────────────────────────────────

  abrirDesignar(curso: CursoDefinicion): void {
    this.cerrarMenu();
    this.cursoSeleccionado.set(curso);
    this.designarForm.reset({
      numero_orden: '', boletin: '', fecha_inicio: '', fecha_fin: '',
      persona_ids: [], modulo_ids: [],
    });
    this.modalError.set(null);
    this.modal.set('designar');
  }

  toggleModuloDesignar(moduloId: string): void {
    const actuales = this.designarForm.controls.modulo_ids.value ?? [];
    const next = actuales.includes(moduloId)
      ? actuales.filter((m) => m !== moduloId)
      : [...actuales, moduloId];
    this.designarForm.controls.modulo_ids.setValue(next);
  }

  moduloSeleccionado(moduloId: string): boolean {
    return (this.designarForm.controls.modulo_ids.value ?? []).includes(moduloId);
  }

  guardarDesignar(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    const raw = this.designarForm.getRawValue();

    if (!raw.fecha_inicio || !raw.fecha_fin) {
      this.modalError.set('Las fechas de inicio y fin son obligatorias.');
      return;
    }
    if (!raw.numero_orden?.trim() && !raw.boletin?.trim()) {
      this.modalError.set('Debés ingresar al menos el N° de orden o el boletín.');
      return;
    }

    const personaIds = (raw.persona_ids ?? []).map((id) => Number(id));
    if (personaIds.length === 0) {
      this.modalError.set('Seleccioná al menos una persona.');
      return;
    }

    this.modalError.set(null);
    this.designando.set(true);
    this.cursosService
      .crearDesignacion(curso.id, {
        persona_ids: personaIds,
        modulo_ids: (raw.modulo_ids ?? []).map((id) => Number(id)),
        numero_orden: raw.numero_orden || undefined,
        boletin: raw.boletin || undefined,
        fecha_inicio: raw.fecha_inicio || undefined,
        fecha_fin: raw.fecha_fin || undefined,
      })
      .subscribe({
        next: (res) => {
          this.designando.set(false);
          this.cerrarModal();
          this.toast.success(`Designación registrada: ${res.personas_designadas} persona(s)`);
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.designando.set(false);
          this.modalError.set(this.parseError(err));
        },
      });
  }

  // ── Editar curso ──────────────────────────────────────────────────────────

  abrirEditar(curso: CursoDefinicion): void {
    this.cerrarMenu();
    this.cursoSeleccionado.set(curso);
    this.editarForm.reset({
      nombre_curso: curso.nombre_curso,
      institucion: curso.institucion,
      es_obligatorio: curso.es_obligatorio ?? false,
    });
    this.modalError.set(null);
    this.modal.set('editar');
  }

  guardarEditar(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;
    if (this.editarForm.invalid) {
      this.editarForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
      return;
    }
    const { nombre_curso, institucion, es_obligatorio } = this.editarForm.getRawValue();
    this.modalError.set(null);
    this.cursosService
      .editarCurso(curso.id, {
        nombre_curso: nombre_curso!,
        institucion: institucion!,
        es_obligatorio: es_obligatorio ?? false,
      })
      .subscribe({
        next: (actualizado) => {
          this.definiciones.update((lista) =>
            lista.map((d) => (d.id === curso.id ? { ...d, ...actualizado } : d)),
          );
          this.cerrarModal();
          this.toast.success('Curso actualizado');
        },
        error: (err: HttpErrorResponse) => this.modalError.set(this.parseError(err)),
      });
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  guardarRegistro(): void {
    if (this.registrarForm.invalid) {
      this.registrarForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
      return;
    }
    const { personaId, nombre, institucion, tipo, fechaInicio, fechaFin, estado } =
      this.registrarForm.getRawValue();

    this.modalError.set(null);
    this.cursosService
      .createHistorial(
        {
          personaId: personaId!,
          nombre: nombre!,
          institucion: institucion!,
          tipo: tipo as TipoCurso,
          fechaInicio: fechaInicio!,
          fechaFin: fechaFin!,
          estado: estado as EstadoCurso,
        },
        this.archivoCertificado(),
      )
      .subscribe({
        next: () => {
          this.cerrarModal();
          this.toast.success('Curso registrado correctamente');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => this.modalError.set(this.parseError(err)),
      });
  }

  guardarNuevoCurso(): void {
    if (this.nuevoCursoForm.invalid) {
      this.nuevoCursoForm.markAllAsTouched();
      this.modalError.set('Completá todos los campos requeridos');
      return;
    }
    const raw = this.nuevoCursoForm.getRawValue();
    const designarAhora = !!raw.designar_ahora;
    const personaIds = (raw.persona_ids ?? []).map((id) => Number(id));

    if (designarAhora && personaIds.length === 0) {
      this.modalError.set('Seleccioná al menos una persona para designar, o desactivá "Designar ahora".');
      return;
    }
    if (designarAhora && (!raw.fecha_inicio || !raw.fecha_fin)) {
      this.modalError.set('Las fechas de inicio y fin son obligatorias para la designación.');
      return;
    }
    if (designarAhora && !raw.numero_orden?.trim() && !raw.boletin?.trim()) {
      this.modalError.set('Debés ingresar al menos el N° de orden o el boletín.');
      return;
    }

    this.modalError.set(null);
    this.cursosService
      .createDefinicion({
        nombre_curso: raw.nombre_curso!,
        institucion: raw.institucion!,
        es_obligatorio: raw.es_obligatorio ?? false,
      })
      .subscribe({
        next: (nuevo) => {
          this.definiciones.update((lista) => [...lista, nuevo]);

          if (!designarAhora) {
            this.cerrarModal();
            this.toast.success(`Curso "${nuevo.nombre_curso}" creado correctamente`);
            return;
          }

          // Designación a nivel curso (sin módulos: el curso recién se crea).
          this.cursosService
            .crearDesignacion(nuevo.id, {
              persona_ids: personaIds,
              numero_orden: raw.numero_orden || undefined,
              boletin: raw.boletin || undefined,
              fecha_inicio: raw.fecha_inicio || undefined,
              fecha_fin: raw.fecha_fin || undefined,
            })
            .subscribe({
              next: () => {
                this.cerrarModal();
                this.toast.success(`Curso "${nuevo.nombre_curso}" creado y designado`);
                this.cargar();
              },
              error: (err: HttpErrorResponse) => {
                this.toast.error('Curso creado, pero falló la designación: ' + this.parseError(err));
                this.cerrarModal();
              },
            });
        },
        error: (err: HttpErrorResponse) => this.modalError.set(this.parseError(err)),
      });
  }

  agregarModulo(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;
    if (this.moduloForm.invalid) {
      this.moduloForm.markAllAsTouched();
      this.modalError.set('El nombre del módulo es requerido');
      return;
    }
    const { nombre, descripcion } = this.moduloForm.getRawValue();

    this.modalError.set(null);
    this.guardandoModulo.set(true);
    this.cursosService
      .createModulo(curso.id, {
        nombre_modulo: nombre!,
        orden_modulo: (curso.modulos?.length ?? 0) + 1,
        descripcion: descripcion || undefined,
      })
      .subscribe({
        next: (nuevoModulo) => {
          const actualizado = { ...curso, modulos: [...(curso.modulos ?? []), nuevoModulo] };
          this.cursoSeleccionado.set(actualizado);
          this.definiciones.update((lista) =>
            lista.map((d) => (d.id === curso.id ? actualizado : d)),
          );
          this.moduloForm.reset({ nombre: '', descripcion: '' });
          this.guardandoModulo.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.modalError.set(this.parseError(err));
          this.guardandoModulo.set(false);
        },
      });
  }

  eliminarCurso(curso: CursoDefinicion): void {
    this.cerrarMenu();
    if (!confirm(`¿Eliminar el curso "${curso.nombre_curso}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    this.cursosService.deleteDefinicion(curso.id).subscribe({
      next: () => {
        if (this.definiciones().length === 1 && this.defPage() > 1) {
          this.defPage.update((p) => p - 1);
        }
        this.cargarDefiniciones();
        this.toast.success(`Curso "${curso.nombre_curso}" eliminado`);
      },
      error: (err: HttpErrorResponse) => this.toast.error(this.parseError(err)),
    });
  }

  eliminarModulo(modulo: ModuloCurso): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    this.cursosService.deleteModulo(curso.id, modulo.id).subscribe({
      next: () => {
        const actualizado = {
          ...curso,
          modulos: (curso.modulos ?? []).filter((m) => m.id !== modulo.id),
        };
        this.cursoSeleccionado.set(actualizado);
        this.definiciones.update((lista) =>
          lista.map((d) => (d.id === curso.id ? actualizado : d)),
        );
      },
      error: (err: HttpErrorResponse) => this.toast.error(this.parseError(err)),
    });
  }

  // ── Archivo ────────────────────────────────────────────────────────────────

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.archivoCertificado.set(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) this.archivoCertificado.set(file);
  }

  // ── Calificaciones ────────────────────────────────────────────────────────

  abrirCalificacionMasiva(): void {
    this.cursoMasivoId.set(null);
    this.calificacionesMasivas.set({});
    this.modalError.set(null);
    this.modal.set('calificacionMasiva');
  }

  onCursoMasivoChange(cursoId: string): void {
    this.cursoMasivoId.set(cursoId);
    const inicial: Record<string, number> = {};
    for (const fila of this.filasCursoMasivo()) {
      inicial[fila.curso.designacionId] = 10;
    }
    this.calificacionesMasivas.set(inicial);
  }

  setCalificacionMasiva(designacionId: string, valor: number): void {
    this.calificacionesMasivas.update((prev) => ({ ...prev, [designacionId]: valor }));
  }

  guardarCalificacionMasiva(): void {
    const filas = this.filasCursoMasivo();
    const notas = this.calificacionesMasivas();
    if (filas.length === 0) return;

    for (const fila of filas) {
      const val = notas[fila.curso.designacionId];
      if (!val || isNaN(val) || val < 1 || val > 10 || !Number.isInteger(Math.round(val))) {
        this.modalError.set(`Nota inválida para ${fila.nombre} (debe ser entre 1 y 10)`);
        return;
      }
    }

    this.modalError.set(null);
    this.guardandoMasivo.set(true);

    const requests = filas.map((fila) =>
      this.cursosService.registrarCalificacion(
        fila.curso.id,
        fila.curso.designacionId,
        Math.round(notas[fila.curso.designacionId]),
      ),
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const porDesignacion = new Map(filas.map((f, i) => [f.curso.designacionId, results[i]]));
        this.funcionarios.update((lista) =>
          lista.map((f) => ({
            ...f,
            cursos: f.cursos.map((c) => {
              const res = porDesignacion.get(c.designacionId);
              return res ? { ...c, calificacion: res.calificacion } : c;
            }),
          })),
        );
        this.guardandoMasivo.set(false);
        this.cerrarModal();
        this.toast.success(`${filas.length} calificación(es) registrada(s) correctamente`);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoMasivo.set(false);
        this.modalError.set('Error al registrar calificaciones: ' + this.parseError(err));
      },
    });
  }

  cursoTerminado(curso: CursoFuncionarioItem): boolean {
    if (!curso.fechaFin) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return new Date(curso.fechaFin) < hoy;
  }

  iniciarCalificacion(fila: FilaHistorial): void {
    this.calificandoId.set(`${fila.funcionarioId}-${fila.curso.id}-${fila.curso.designacionId}`);
    this.calificacionValor.set(10);
  }

  cancelarCalificacion(): void {
    this.calificandoId.set(null);
  }

  guardarCalificacion(fila: FilaHistorial): void {
    const val = Math.round(this.calificacionValor());
    if (isNaN(val) || val < 1 || val > 10) {
      this.toast.error('La calificación debe ser un número entero entre 1 y 10');
      return;
    }
    this.guardandoCalificacion.set(true);
    this.cursosService.registrarCalificacion(fila.curso.id, fila.curso.designacionId, val).subscribe({
      next: (res) => {
        this.funcionarios.update((lista) =>
          lista.map((f) =>
            f.id !== fila.funcionarioId
              ? f
              : {
                  ...f,
                  cursos: f.cursos.map((c) =>
                    c.designacionId === fila.curso.designacionId
                      ? { ...c, calificacion: res.calificacion }
                      : c,
                  ),
                },
          ),
        );
        this.calificandoId.set(null);
        this.guardandoCalificacion.set(false);
        this.toast.success('Calificación registrada correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoCalificacion.set(false);
        this.toast.error(this.parseError(err));
      },
    });
  }

  // ── Tracks ─────────────────────────────────────────────────────────────────
  trackFila = (_: number, f: FilaHistorial) => `${f.funcionarioId}-${f.curso.id}`;
  trackDefinicion = (_: number, d: CursoDefinicion) => d.id;
  trackModulo = (_: number, m: ModuloCurso) => m.id;

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Error inesperado';
  }
}
