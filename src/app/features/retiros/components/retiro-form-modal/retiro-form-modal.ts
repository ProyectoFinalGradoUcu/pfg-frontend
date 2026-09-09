import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, debounceTime, distinctUntilChanged, merge, switchMap, takeUntil } from 'rxjs';
import {
  CrearRetiroBody,
  MotivoBajaCatalogo,
  PreviaRetiro,
  RetiroCreado,
} from '../../../../core/models/retiros.models';
import { PersonaListItem } from '../../../../core/models/personal.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { parseError } from '../../../../shared/utils/parse-error';
import { DEBOUNCE_MS } from '../../retiro-presentacion';

type Paso = 'persona' | 'datos' | 'confirmar';

/** Se arma con lo que se cerró de verdad, no con lo que anticipó la previa. */
export function mensajeCierres(c: RetiroCreado['cerrado']): string {
  const partes: string[] = [];
  if (c.destino) partes.push('se cerró el destino');

  const n = c.inscripciones.length;
  if (n === 1) partes.push('se dio de baja 1 inscripción');
  if (n > 1) partes.push(`se dieron de baja ${n} inscripciones`);

  if (c.usuario) partes.push('se bloqueó la cuenta de sistema');

  return partes.length
    ? `Retiro registrado: ${partes.join(', ')}.`
    : 'Retiro registrado. No arrastró ningún cierre.';
}

@Component({
  selector: 'app-retiro-form-modal',
  standalone: false,
  templateUrl: './retiro-form-modal.html',
  styleUrl: './retiro-form-modal.scss',
})
export class RetiroFormModal implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly retirosService = inject(RetirosService);
  private readonly catalogos = inject(CatalogosService);
  private readonly personalService = inject(PersonalService);

  /** `null` abre el paso de selección: es la entrada desde el listado. */
  @Input() personaId: string | null = null;

  @Output() registrado = new EventEmitter<RetiroCreado>();
  @Output() cerrado = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();
  /** Cambiar de persona también invalida la previa, aunque la fecha no cambie. */
  private readonly personaCambiada$ = new Subject<void>();

  /** El modal elige la persona solo si no se la pasaron al abrirlo. */
  eligePersona = false;

  readonly paso = signal<Paso>('datos');
  readonly motivos = signal<MotivoBajaCatalogo[]>([]);
  readonly previa = signal<PreviaRetiro | null>(null);
  readonly previaCargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  readonly cerrarDestino = signal(false);
  readonly cerrarUsuario = signal(false);
  readonly inscripcionesElegidas = signal<string[]>([]);

  // Paso 0: el padrón completo en un `app-select` con buscador.
  readonly personal = signal<PersonaListItem[]>([]);
  readonly cargandoPersonal = signal(false);
  readonly personaElegida = signal<PersonaListItem | null>(null);

  /** El backend rechaza un retiro con fecha futura. */
  readonly hoy = new Date().toISOString().slice(0, 10);

  readonly form = this.fb.nonNullable.group({
    fecha_retiro: ['', Validators.required],
    hora_retiro: [''],
    motivo_baja_id: [null as number | null, Validators.required],
    motivo: [''],
    numero_orden: [''],
    boletin: [''],
    observaciones: [''],
  });

  readonly bloqueos = computed(() => this.previa()?.bloqueos ?? []);

  /**
   * Método y no `computed`: `form.valid` no es un signal. En un computed el `&&`
   * cortaría antes de leer los signals y quedaría sin dependencias que lo invaliden.
   */
  puedeConfirmar(): boolean {
    return this.form.valid && !!this.previa() && this.bloqueos().length === 0 && !this.enviando();
  }

  ngOnInit(): void {
    this.eligePersona = !this.personaId;
    this.paso.set(this.personaId ? 'datos' : 'persona');
    this.catalogos.getMotivosBaja().subscribe({ next: (m) => this.motivos.set(m) });

    // Dos disparadores: la fecha y el cambio de persona. El `distinctUntilChanged`
    // va solo sobre la fecha: si cubriera ambos, cambiar de funcionario sin tocar la
    // fecha dejaría en pantalla el impacto del anterior.
    merge(
      this.form.controls.fecha_retiro.valueChanges.pipe(
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
      ),
      this.personaCambiada$,
    )
      .pipe(
        switchMap(() => {
          const fecha = this.form.controls.fecha_retiro.value;
          this.previa.set(null);
          if (!fecha || !this.personaId) return EMPTY;
          this.previaCargando.set(true);
          return this.retirosService.previa(this.personaId, fecha);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (p) => {
          this.previaCargando.set(false);
          this.aplicarPrevia(p);
        },
        error: (err: HttpErrorResponse) => {
          this.previaCargando.set(false);
          this.error.set(parseError(err));
        },
      });

    if (!this.personaId) this.cargarPersonal();
  }

  /** El padrón activo es exactamente a quién se puede retirar. */
  private cargarPersonal(): void {
    this.cargandoPersonal.set(true);
    this.personal.set([]);
    this.personalService.findAll().subscribe({
      next: (p) => {
        this.personal.set(p);
        this.cargandoPersonal.set(false);
      },
      error: () => this.cargandoPersonal.set(false),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Un checkbox tildado por cada ítem con `cerrar_sugerido`. */
  private aplicarPrevia(p: PreviaRetiro): void {
    this.previa.set(p);
    this.cerrarDestino.set(p.destino_vigente?.cerrar_sugerido ?? false);
    this.cerrarUsuario.set(p.usuario?.cerrar_sugerido ?? false);
    this.inscripcionesElegidas.set(
      p.inscripciones_activas.filter((i) => i.cerrar_sugerido).map((i) => i.id),
    );
  }

  /** El `app-select` emite el id; la persona se resuelve del catálogo ya cargado. */
  elegirPersona(id: string | null): void {
    const elegida = this.personal().find((p) => p.id === id) ?? null;
    if (elegida?.id === this.personaId) return;

    this.personaElegida.set(elegida);
    this.personaId = elegida?.id ?? null;
    this.error.set(null);
    // La previa cargada es la del funcionario anterior.
    this.previa.set(null);
    this.personaCambiada$.next();

    if (elegida) this.paso.set('datos');
  }

  /** Vuelve al paso 0 para elegir a otro funcionario sin cerrar el modal. */
  cambiarPersona(): void {
    this.paso.set('persona');
  }

  toggleInscripcion(id: string): void {
    this.inscripcionesElegidas.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  irAConfirmar(): void {
    if (!this.puedeConfirmar()) {
      this.form.markAllAsTouched();
      return;
    }
    this.paso.set('confirmar');
  }

  volverADatos(): void {
    this.paso.set('datos');
  }

  confirmar(): void {
    if (!this.puedeConfirmar()) return;

    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);

    // `cerrar` va siempre explícito: omitirlo fuerza la cascada completa.
    const body: CrearRetiroBody = {
      persona_id: Number(this.personaId),
      fecha_retiro: v.fecha_retiro,
      motivo_baja_id: Number(v.motivo_baja_id),
      cerrar: {
        destino: this.cerrarDestino(),
        // Ids de inscripción, no de curso.
        inscripciones: this.inscripcionesElegidas().map(Number),
        usuario: this.cerrarUsuario(),
      },
    };
    if (v.hora_retiro) body.hora_retiro = v.hora_retiro;
    if (v.motivo.trim()) body.motivo = v.motivo.trim();
    if (v.numero_orden.trim()) body.numero_orden = v.numero_orden.trim();
    if (v.boletin.trim()) body.boletin = v.boletin.trim();
    if (v.observaciones.trim()) body.observaciones = v.observaciones.trim();

    this.retirosService.registrar(body).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.registrado.emit(r);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(parseError(err));
        this.paso.set('datos');
      },
    });
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
