import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  CrearOrdenPayload,
  ESTADOS_ELEGIBILIDAD,
  Elegibilidad,
  EstadoElegibilidad,
  FuncionarioDeOrdenPayload,
} from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

/** Un funcionario ya agregado a la orden. */
interface FilaDeOrden {
  evaluacion: Elegibilidad;
  grado_destino_id: string | null;
  fecha_ascenso: string;
  motivo_excepcion: string;
}

/**
 * Registro de una orden en tres pasos. Se llega desde el listado de pasibles con
 * una selección, desde el perfil con una persona, o vacío.
 */
/** La orden se identifica por el N.º de O.C.G.F.A. o por el boletín: al menos uno. */
function alMenosOrdenOBoletin(group: AbstractControl): ValidationErrors | null {
  const numero = String(group.get('numero_orden')?.value ?? '').trim();
  const boletin = String(group.get('boletin')?.value ?? '').trim();
  return numero || boletin ? null : { sinOrdenNiBoletin: true };
}

@Component({
  selector: 'app-nueva-orden-page',
  standalone: false,
  templateUrl: './nueva-orden-page.html',
  styleUrl: './nueva-orden-page.scss',
})
export class NuevaOrdenPage implements OnInit, OnDestroy {
  private readonly svc = inject(AscensosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly paso = signal<1 | 2 | 3>(1);
  readonly guardando = signal(false);
  readonly buscando = signal(false);

  readonly resultados = signal<Elegibilidad[]>([]);
  readonly filas = signal<FilaDeOrden[]>([]);

  readonly puedeExcepcion = computed(() => this.auth.hasPermiso('ascensos.excepcion'));

  readonly ordenForm: FormGroup = this.fb.group(
    {
      numero_orden: ['', Validators.maxLength(50)],
      fecha_orden: ['', Validators.required],
      boletin: ['', Validators.maxLength(50)],
      observaciones: [''],
    },
    { validators: alMenosOrdenOBoletin },
  );

  /** Cuántos van por excepción. */
  readonly porExcepcion = computed(() => this.filas().filter((f) => this.esExcepcion(f)).length);

  readonly hayExcepcionSinMotivo = computed(() =>
    this.filas().some((f) => this.esExcepcion(f) && !f.motivo_excepcion.trim()),
  );

  readonly puedeConfirmar = computed(
    () =>
      this.filas().length > 0 &&
      !this.hayExcepcionSinMotivo() &&
      (this.porExcepcion() === 0 || this.puedeExcepcion()) &&
      this.filas().every((f) => !!f.grado_destino_id),
  );

  private readonly busqueda$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((texto) => this.buscar(texto));

    const params = this.route.snapshot.queryParamMap;
    const ids = [
      ...(params.get('persona') ? [params.get('persona')!] : []),
      ...(params.get('personas')?.split(',').filter(Boolean) ?? []),
    ];
    for (const id of ids) this.agregarPorId(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Paso 1: la orden ─────────────────────────────────────────────────────

  irAFuncionarios(): void {
    if (this.ordenForm.invalid) {
      this.ordenForm.markAllAsTouched();
      return;
    }
    const fecha = this.ordenForm.get('fecha_orden')!.value as string;
    this.filas.update((filas) =>
      filas.map((f) => ({ ...f, fecha_ascenso: f.fecha_ascenso || fecha })),
    );
    this.paso.set(2);
  }

  volverAOrden(): void {
    this.paso.set(1);
  }

  hayError(control: string): boolean {
    const ctrl = this.ordenForm.get(control);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  /** Recién se avisa cuando tocó alguno de los dos campos. */
  faltaOrdenYBoletin(): boolean {
    return (
      this.ordenForm.hasError('sinOrdenNiBoletin') &&
      (!!this.ordenForm.get('numero_orden')?.touched ||
        !!this.ordenForm.get('boletin')?.touched)
    );
  }

  // ─── Paso 2: los funcionarios ─────────────────────────────────────────────

  onBusqueda(texto: string): void {
    this.busqueda$.next(texto);
  }

  private buscar(texto: string): void {
    if (texto.trim().length < 2) {
      this.resultados.set([]);
      return;
    }
    this.buscando.set(true);
    this.svc
      .listarPasibles({
        query: texto,
        // Todos los estados: se puede ascender a alguien que no cumple, como excepción.
        estado: ['PASIBLE', 'PROXIMO', 'BLOQUEADO', 'FUERA_DE_EDAD', 'SIN_REGLA'],
        pageSize: 20,
        horizonte_meses: 120,
        fecha_referencia: this.fechaDeLaOrden(),
      })
      .subscribe({
        next: (res) => {
          const yaEstan = new Set(this.filas().map((f) => f.evaluacion.persona.id));
          this.resultados.set(res.items.filter((i) => !yaEstan.has(i.persona.id)));
          this.buscando.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.buscando.set(false);
          this.toast.error(parseError(err));
        },
      });
  }

  private agregarPorId(personaId: string): void {
    this.svc.getElegibilidad(personaId, this.fechaDeLaOrden() || undefined).subscribe({
      next: (e) => this.agregar(e),
      error: (err: HttpErrorResponse) => this.toast.error(parseError(err)),
    });
  }

  agregar(evaluacion: Elegibilidad): void {
    if (this.filas().some((f) => f.evaluacion.persona.id === evaluacion.persona.id)) return;

    this.filas.update((filas) => [
      ...filas,
      {
        evaluacion,
        grado_destino_id: evaluacion.grado_destino?.id ?? null,
        fecha_ascenso: this.fechaDeLaOrden(),
        motivo_excepcion: '',
      },
    ]);
    this.resultados.update((r) => r.filter((i) => i.persona.id !== evaluacion.persona.id));
  }

  quitar(personaId: string): void {
    this.filas.update((filas) => filas.filter((f) => f.evaluacion.persona.id !== personaId));
  }

  onFechaAscenso(personaId: string, fecha: string): void {
    this.filas.update((filas) =>
      filas.map((f) =>
        f.evaluacion.persona.id === personaId ? { ...f, fecha_ascenso: fecha } : f,
      ),
    );
  }

  onMotivo(personaId: string, motivo: string): void {
    this.filas.update((filas) =>
      filas.map((f) =>
        f.evaluacion.persona.id === personaId ? { ...f, motivo_excepcion: motivo } : f,
      ),
    );
  }

  /** Tiene regla evaluable y el motor no lo dio por pasible. */
  esExcepcion(fila: FilaDeOrden): boolean {
    return !!fila.evaluacion.regla && fila.evaluacion.estado !== 'PASIBLE';
  }

  etiquetaEstado(estado: EstadoElegibilidad): string {
    return ESTADOS_ELEGIBILIDAD.find((e) => e.value === estado)?.label ?? estado;
  }

  fechaDeLaOrden(): string {
    return (this.ordenForm.get('fecha_orden')!.value as string) ?? '';
  }

  // ─── Paso 3: confirmación ─────────────────────────────────────────────────

  irAConfirmar(): void {
    if (!this.puedeConfirmar()) return;
    this.paso.set(3);
  }

  volverAFuncionarios(): void {
    this.paso.set(2);
  }

  confirmar(): void {
    if (!this.puedeConfirmar()) return;

    const raw = this.ordenForm.getRawValue();
    const funcionarios: FuncionarioDeOrdenPayload[] = this.filas().map((f) => ({
      persona_id: Number(f.evaluacion.persona.id),
      grado_destino_id: f.grado_destino_id ? Number(f.grado_destino_id) : undefined,
      fecha_ascenso: f.fecha_ascenso || undefined,
      motivo_excepcion: this.esExcepcion(f) ? f.motivo_excepcion.trim() : undefined,
    }));

    const payload: CrearOrdenPayload = {
      numero_orden: String(raw.numero_orden ?? '').trim() || undefined,
      fecha_orden: String(raw.fecha_orden),
      boletin: String(raw.boletin ?? '').trim() || undefined,
      observaciones: String(raw.observaciones ?? '').trim() || undefined,
      funcionarios,
    };

    this.guardando.set(true);
    this.svc.crearOrden(payload).subscribe({
      next: (orden) => {
        this.guardando.set(false);
        this.toast.success(
          `Orden ${orden.numero_orden ?? orden.boletin} registrada: ${orden.cantidad_funcionarios} funcionarios`,
        );
        this.router.navigate(['/ascensos-y-retiros/ordenes', orden.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.toast.error(parseError(err));
        this.paso.set(2);
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/ascensos-y-retiros/ordenes']);
  }
}
