import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, debounceTime, distinctUntilChanged, expand, reduce, takeUntil } from 'rxjs';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  CrearOrdenPayload,
  ESTADOS_ELEGIBILIDAD,
  Elegibilidad,
  EstadoElegibilidad,
  FuncionarioDeOrdenPayload,
  RequisitoEvaluado,
} from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

/** Un funcionario ya agregado a la orden. */
interface FilaDeOrden {
  evaluacion: Elegibilidad;
  grado_destino_id: string | null;
  fecha_ascenso: string;
  motivo_excepcion: string;
}

/** Todos los estados: se puede ascender a alguien que no cumple, como excepción. */
const FILTRO_CANDIDATOS: { estado: EstadoElegibilidad[]; horizonte_meses: number } = {
  estado: ['PASIBLE', 'PROXIMO', 'BLOQUEADO', 'FUERA_DE_EDAD', 'SIN_REGLA'],
  horizonte_meses: 120,
};

/** Cuántos muestra el combobox antes de que se escriba algo. */
const INICIALES = 10;

/** Una opción del combobox de funcionarios. */
interface OpcionFuncionario {
  id: string;
  label: string;
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

  /** El error del grupo N.º de orden / boletín se muestra recién al tocar «Siguiente». */
  readonly intentoSiguiente = signal(false);

  /** Lo que se escribió en el buscador del combobox, para elegir el texto del estado vacío. */
  readonly terminoBusqueda = signal('');

  /** Vuelve a null después de cada elección: el combobox queda listo para el siguiente. */
  readonly selectorFuncionario = new FormControl<string | null>(null);

  readonly opcionesFuncionario = computed<OpcionFuncionario[]>(() =>
    this.resultados().map((r) => ({
      id: r.persona.id,
      label: `${r.persona.nombre_completo} · CI ${r.persona.cedula} · ${r.grado_actual.denominacion}`,
    })),
  );

  readonly textoSinResultados = computed(() =>
    this.terminoBusqueda().trim().length < 2
      ? 'No hay funcionarios para agregar'
      : 'No se encontró ningún funcionario',
  );

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

  /** Cuántos van por excepción y todavía no tienen motivo. */
  readonly excepcionesSinMotivo = computed(
    () => this.filas().filter((f) => this.esExcepcion(f) && !f.motivo_excepcion.trim()).length,
  );

  readonly hayExcepcionSinMotivo = computed(() => this.excepcionesSinMotivo() > 0);

  readonly puedeConfirmar = computed(
    () =>
      this.filas().length > 0 &&
      !this.hayExcepcionSinMotivo() &&
      (this.porExcepcion() === 0 || this.puedeExcepcion()) &&
      this.filas().every((f) => !!f.grado_destino_id),
  );

  /**
   * Todos los candidatos, ordenados por nombre, para la lista inicial del combobox.
   * Depende de la fecha de la orden, que es la fecha con la que se los evalúa.
   */
  private candidatos: { fecha: string; items: Elegibilidad[] } | null = null;

  private readonly busqueda$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((texto) => this.buscar(texto));

    this.selectorFuncionario.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id) => {
        if (!id) return;
        const elegido = this.resultados().find((r) => r.persona.id === id);
        if (elegido) this.agregar(elegido);
        this.selectorFuncionario.setValue(null, { emitEvent: false });
      });

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
    this.intentoSiguiente.set(true);
    if (this.ordenForm.invalid) {
      this.ordenForm.markAllAsTouched();
      return;
    }
    const fecha = this.ordenForm.get('fecha_orden')!.value as string;
    this.filas.update((filas) =>
      filas.map((f) => ({ ...f, fecha_ascenso: f.fecha_ascenso || fecha })),
    );
    this.paso.set(2);
    // Se precarga para que al abrir el combobox la lista ya esté.
    this.mostrarIniciales();
  }

  volverAOrden(): void {
    this.paso.set(1);
  }

  hayError(control: string): boolean {
    const ctrl = this.ordenForm.get(control);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  /** Un solo aviso para el grupo, y recién cuando se intentó avanzar. */
  faltaOrdenYBoletin(): boolean {
    return this.intentoSiguiente() && this.ordenForm.hasError('sinOrdenNiBoletin');
  }

  // ─── Paso 2: los funcionarios ─────────────────────────────────────────────

  onBusqueda(texto: string): void {
    this.terminoBusqueda.set(texto);
    // Sin término, la lista inicial sale al instante; la búsqueda sí espera el debounce.
    if (this.terminoCorto()) this.mostrarIniciales();
    this.busqueda$.next(texto);
  }

  private terminoCorto(): boolean {
    return this.terminoBusqueda().trim().length < 2;
  }

  private buscar(texto: string): void {
    if (texto.trim().length < 2) return;
    this.buscando.set(true);
    this.svc
      .listarPasibles({
        ...FILTRO_CANDIDATOS,
        query: texto,
        pageSize: 20,
        fecha_referencia: this.fechaDeLaOrden(),
      })
      .subscribe({
        next: (res) => {
          this.buscando.set(false);
          // Si mientras tanto se borró o cambió el término, esta respuesta ya no aplica.
          if (texto !== this.terminoBusqueda()) return;
          this.resultados.set(this.sinLosYaAgregados(res.items));
        },
        error: (err: HttpErrorResponse) => {
          this.buscando.set(false);
          this.toast.error(parseError(err));
        },
      });
  }

  /** Los primeros por nombre, en orden alfabético, sin los que ya están en la orden. */
  private mostrarIniciales(): void {
    const fecha = this.fechaDeLaOrden();
    if (this.candidatos?.fecha === fecha) {
      this.resultados.set(this.sinLosYaAgregados(this.candidatos.items).slice(0, INICIALES));
      return;
    }

    // El backend ordena por apellido: se traen todos y se ordena acá por nombre.
    const pagina = (page: number) =>
      this.svc.listarPasibles({ ...FILTRO_CANDIDATOS, page, pageSize: 500, fecha_referencia: fecha });

    this.buscando.set(true);
    pagina(1)
      .pipe(
        expand((res) => (res.page * res.pageSize < res.total ? pagina(res.page + 1) : EMPTY)),
        reduce((todos, res) => todos.concat(res.items), [] as Elegibilidad[]),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (todos) => {
          this.buscando.set(false);
          const items = [...todos].sort((a, b) =>
            a.persona.nombre_completo.localeCompare(b.persona.nombre_completo, 'es'),
          );
          this.candidatos = { fecha, items };
          if (this.terminoCorto()) {
            this.resultados.set(this.sinLosYaAgregados(items).slice(0, INICIALES));
          }
        },
        error: (err: HttpErrorResponse) => {
          this.buscando.set(false);
          this.toast.error(parseError(err));
        },
      });
  }

  private sinLosYaAgregados(items: Elegibilidad[]): Elegibilidad[] {
    const yaEstan = new Set(this.filas().map((f) => f.evaluacion.persona.id));
    return items.filter((i) => !yaEstan.has(i.persona.id));
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

  /**
   * Sin esto el `*ngFor` recrea la card en cada tecla del motivo (`onMotivo`
   * reemplaza el array) y el input pierde el foco a mitad de la escritura.
   */
  trackFila = (_: number, fila: FilaDeOrden): string => fila.evaluacion.persona.id;

  /** Los requisitos que el motor evaluó como no cumplidos, para mostrarlos como chips. */
  requisitosFaltantes(fila: FilaDeOrden): RequisitoEvaluado[] {
    return fila.evaluacion.requisitos.filter((r) => r.aplica && !r.cumple);
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
