import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CursosService } from '../../../../core/services/cursos.service';
import { PersonalService, PersonaListItem } from '../../../../core/services/personal.service';
import {
  CursoDefinicion,
  EstadoCurso,
  HistorialCurso,
  ModuloCurso,
  TipoCurso,
} from '../../../../core/models/cursos.models';

type TabKind = 'historial' | 'gestion';
type ModalKind = 'registrarCurso' | 'nuevoCurso' | 'modulos' | null;

@Component({
  selector: 'app-cursos-page',
  standalone: false,
  templateUrl: './cursos-page.html',
  styleUrl: './cursos-page.scss',
})
export class CursosPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cursosService = inject(CursosService);
  private readonly personalService = inject(PersonalService);
  private readonly toast = inject(ToastService);

  // ── Estado general ─────────────────────────────────────────────────────────
  readonly tab = signal<TabKind>('historial');
  readonly loading = signal(false);
  readonly modal = signal<ModalKind>(null);
  readonly modalError = signal<string | null>(null);

  // ── Historial ──────────────────────────────────────────────────────────────
  readonly historial = signal<HistorialCurso[]>([]);
  readonly personal = signal<PersonaListItem[]>([]);
  readonly historialPage = signal(1);
  readonly historialPageSize = 10;
  readonly archivoCertificado = signal<File | null>(null);
  readonly dragOver = signal(false);

  // ── Gestión ────────────────────────────────────────────────────────────────
  readonly definiciones = signal<CursoDefinicion[]>([]);
  readonly defPage = signal(1);
  readonly defPageSize = 10;
  readonly cursoSeleccionado = signal<CursoDefinicion | null>(null);
  readonly guardandoModulo = signal(false);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly puedeGestionar = computed(() => this.auth.hasPermiso('cursos.gestionar'));

  readonly completados = computed(
    () => this.historial().filter((h) => h.estado === 'completado').length,
  );
  readonly enCurso = computed(
    () => this.historial().filter((h) => h.estado === 'en_curso').length,
  );
  readonly obligatorios = computed(
    () => this.historial().filter((h) => h.tipo === 'obligatorio').length,
  );

  readonly historialPaginado = computed<HistorialCurso[]>(() => {
    const start = (this.historialPage() - 1) * this.historialPageSize;
    return this.historial().slice(start, start + this.historialPageSize);
  });

  readonly definicionesPaginadas = computed<CursoDefinicion[]>(() => {
    const start = (this.defPage() - 1) * this.defPageSize;
    return this.definiciones().slice(start, start + this.defPageSize);
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
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    tipo: ['' as TipoCurso | '', Validators.required],
    descripcion: [''],
  });

  readonly moduloForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: [''],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    forkJoin({
      historial: this.cursosService.findAllHistorial(),
      definiciones: this.cursosService.findAllDefiniciones(),
      personal: this.personalService.findAll(),
    }).subscribe({
      next: ({ historial, definiciones, personal }) => {
        this.historial.set(historial);
        this.definiciones.set(definiciones);
        this.personal.set(personal);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.loading.set(false);
      },
    });
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
    this.nuevoCursoForm.reset({ nombre: '', tipo: '', descripcion: '' });
    this.modalError.set(null);
    this.modal.set('nuevoCurso');
  }

  abrirModulos(curso: CursoDefinicion): void {
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
    const { nombre, tipo, descripcion } = this.nuevoCursoForm.getRawValue();

    this.modalError.set(null);
    this.cursosService
      .createDefinicion({
        nombre: nombre!,
        tipo: tipo as TipoCurso,
        descripcion: descripcion || undefined,
      })
      .subscribe({
        next: (nuevo) => {
          this.cerrarModal();
          this.toast.success(`Curso "${nuevo.nombre}" creado correctamente`);
          this.definiciones.update((lista) => [...lista, nuevo]);
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
        nombre: nombre!,
        descripcion: descripcion || undefined,
        orden: curso.modulos.length + 1,
      })
      .subscribe({
        next: (nuevoModulo) => {
          const actualizado = { ...curso, modulos: [...curso.modulos, nuevoModulo] };
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

  eliminarModulo(modulo: ModuloCurso): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    this.cursosService.deleteModulo(curso.id, modulo.id).subscribe({
      next: () => {
        const actualizado = {
          ...curso,
          modulos: curso.modulos.filter((m) => m.id !== modulo.id),
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

  // ── Tracks ─────────────────────────────────────────────────────────────────
  trackHistorial = (_: number, h: HistorialCurso) => h.id;
  trackDefinicion = (_: number, d: CursoDefinicion) => d.id;
  trackModulo = (_: number, m: ModuloCurso) => m.id;

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Error inesperado';
  }
}
