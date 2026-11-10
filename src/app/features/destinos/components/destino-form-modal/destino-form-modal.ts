import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { DestinosService, payloadEdicion } from '../../../../core/services/destinos.service';
import { PersonalService } from '../../../../core/services/personal.service';
import { CrearDestinoPayload, Destino, SubUnidadConDestinados } from '../../../../core/models/destinos.models';
import { PersonaListItem } from '../../../../core/models/personal.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { DEBOUNCE_MS, etiquetaSubUnidad, nombreDestino } from '../../destino-presentacion';

const MIN_CARACTERES_BUSQUEDA = 2;

export type PersonaDelPase = Pick<PersonaListItem, 'id' | 'nombre' | 'cedula'>;

/** Deja solo la parte YYYY-MM-DD de un valor de fecha que traiga el backend. */
function fechaTexto(valor: string | null | undefined): string {
  return valor ? String(valor).slice(0, 10) : '';
}

/** Resta un día a una fecha `AAAA-MM-DD` en UTC, para no depender del huso del navegador. */
export function diaAnterior(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-destino-form-modal',
  standalone: false,
  templateUrl: './destino-form-modal.html',
  styleUrl: './destino-form-modal.scss',
})
export class DestinoFormModal implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly destinosService = inject(DestinosService);
  private readonly personalService = inject(PersonalService);

  /** `null` crea un destino; con un destino, lo edita. */
  @Input() destino: Destino | null = null;

  /** Al registrar desde el perfil la persona ya viene elegida y no se puede cambiar. */
  @Input() persona: PersonaDelPase | null = null;

  @Output() guardado = new EventEmitter<Destino>();
  @Output() cerrado = new EventEmitter<void>();

  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  /** Los destinos posibles: sub-unidades vigentes, ya ordenadas por comando desde el backend. */
  readonly subUnidades = signal<SubUnidadConDestinados[]>([]);
  readonly opcionesSubUnidad = computed(() =>
    this.subUnidades().map((s) => ({ value: s.id, label: etiquetaSubUnidad(s) })),
  );

  // ── Búsqueda de persona (solo en modo crear) ────────────────────────────────
  readonly terminoBusqueda = signal('');
  readonly buscando = signal(false);
  readonly resultados = signal<PersonaListItem[]>([]);
  readonly personaElegida = signal<PersonaDelPase | null>(null);

  // ── Preview del pase ────────────────────────────────────────────────────────
  readonly destinoActual = signal<Destino | null>(null);
  readonly buscandoDestinoActual = signal(false);
  /** Distinto de "no tiene destino": la búsqueda falló y no sabemos qué se va a cerrar. */
  readonly errorDestinoActual = signal<string | null>(null);

  readonly form = this.fb.group({
    sub_unidad_id: ['', Validators.required],
    fecha_inicio: ['', Validators.required],
    posicion_destino: ['', Validators.maxLength(200)],
    numero_orden: ['', Validators.maxLength(50)],
    boletin: ['', Validators.maxLength(50)],
    numero_destino: ['', Validators.maxLength(20)],
    fecha_orden: [''],
    fecha_boletin: [''],
    numero_resolucion: ['', Validators.maxLength(50)],
    fecha_resolucion: [''],
    observaciones: [''],
    /** Solo se manda si el operador la corrige. */
    fecha_fin_anterior: [''],
    /** Solo en modo editar. */
    fecha_fin: [''],
  });

  /**
   * Método, no `computed()`: `computed()` sin dependencias de señal se congela en su
   * primera lectura. Hoy da igual porque la Task 7 monta el modal con `*ngIf` (instancia
   * nueva por apertura), pero un método siempre lee `this.destino` al vuelo.
   */
  editando(): boolean {
    return this.destino !== null;
  }

  /** Día previo a la fecha de inicio: con qué fecha cierra el backend el destino anterior. */
  readonly fechaInicio = signal('');
  readonly fechaCierreCalculada = computed(() => {
    if (!this.destinoActual()) return null;
    const inicio = this.fechaInicio();
    if (!inicio) return null;
    return diaAnterior(inicio);
  });

  readonly subUnidadElegida = signal('');
  /**
   * Un pase a la misma sub-unidad en la que ya revista no es un pase: el backend lo
   * rechaza. Se compara por sub-unidad (el destino), no por comando: moverse entre dos
   * sub-unidades del mismo comando sí es un pase válido.
   */
  readonly mismoDestinoQueElActual = computed(() => {
    const actual = this.destinoActual()?.sub_unidad?.id;
    const elegida = this.subUnidadElegida();
    return !!actual && !!elegida && actual === elegida;
  });

  nombreDestino(d: Destino): string {
    return nombreDestino(d);
  }

  private readonly busquedaSubject = new Subject<void>();

  ngOnInit(): void {
    this.destinosService.listarSubUnidadesParaSelector({ vigente: true }).subscribe({
      next: (s) => this.subUnidades.set(s),
      error: () => this.subUnidades.set([]),
    });

    this.busquedaSubject.pipe(debounceTime(DEBOUNCE_MS)).subscribe(() => this.buscarPersona());

    this.form.get('fecha_inicio')!.valueChanges.subscribe((v) => this.fechaInicio.set(v ?? ''));
    this.form.get('sub_unidad_id')!.valueChanges.subscribe((v) => this.subUnidadElegida.set(v ? String(v) : ''));

    if (this.destino) this.precargarEdicion(this.destino);
    else if (this.persona) this.elegirPersona(this.persona);
  }

  ngOnDestroy(): void {
    this.busquedaSubject.complete();
  }

  // ── Persona ─────────────────────────────────────────────────────────────────

  onBuscarPersona(value: string): void {
    this.terminoBusqueda.set(value);
    if (value.trim().length < MIN_CARACTERES_BUSQUEDA) {
      this.resultados.set([]);
      return;
    }
    this.busquedaSubject.next();
  }

  private buscarPersona(): void {
    const search = this.terminoBusqueda().trim();
    if (search.length < MIN_CARACTERES_BUSQUEDA) return;
    this.buscando.set(true);
    this.personalService.findPaginado({ search, pageSize: 10 }).subscribe({
      next: (res) => {
        this.resultados.set(res.items);
        this.buscando.set(false);
      },
      error: () => {
        this.resultados.set([]);
        this.buscando.set(false);
      },
    });
  }

  elegirPersona(persona: PersonaDelPase): void {
    this.personaElegida.set(persona);
    this.resultados.set([]);
    this.terminoBusqueda.set('');
    this.buscarDestinoActual(persona);
  }

  /**
   * El destino que este pase va a cerrar.
   *
   * `query` en `/destinos` matchea cédula, nombre y apellido de forma parcial: una cédula
   * corta puede matchear otra que la contiene (`5000001` matchea `50000012`), y viene
   * ordenado por `fecha_inicio` descendente, no por relevancia. Por eso se pide una tanda
   * (`pageSize: 50`) y se filtra en el cliente por `persona.id` en vez de asumir `items[0]`.
   * No hay filtro `persona_id` en ese endpoint, así que la guarda tiene que ser acá.
   */
  private buscarDestinoActual(persona: PersonaDelPase): void {
    const personaId = persona.id;
    this.errorDestinoActual.set(null);
    this.buscandoDestinoActual.set(true);
    this.destinosService.listar({ query: persona.cedula, activo: true, pageSize: 50 }).subscribe({
      next: (res) => {
        // Respuesta tardía de una persona que ya no es la elegida: se descarta entera.
        if (this.personaElegida()?.id !== personaId) return;
        this.destinoActual.set(res.items.find((d) => d.persona?.id === personaId) ?? null);
        this.buscandoDestinoActual.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (this.personaElegida()?.id !== personaId) return;
        this.destinoActual.set(null);
        this.errorDestinoActual.set(parseError(err));
        this.buscandoDestinoActual.set(false);
      },
    });
  }

  limpiarPersona(): void {
    this.personaElegida.set(null);
    this.destinoActual.set(null);
    this.errorDestinoActual.set(null);
    this.form.patchValue({ fecha_fin_anterior: '' });
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────

  guardar(): void {
    this.error.set(null);
    const raw = this.form.getRawValue();

    const numeroOrden = (raw.numero_orden ?? '').trim();
    const boletin = (raw.boletin ?? '').trim();

    if (this.editando()) {
      this.guardarEdicion();
      return;
    }

    if (!this.personaElegida() || !raw.sub_unidad_id || !raw.fecha_inicio) {
      this.error.set('Completá los campos requeridos.');
      return;
    }
    if (!numeroOrden && !boletin) {
      this.error.set('Ingresá al menos el N° de orden o el boletín.');
      return;
    }
    if (this.mismoDestinoQueElActual()) {
      this.error.set('El funcionario ya revista en esa base. Elegí otro destino.');
      return;
    }

    const payload: CrearDestinoPayload = {
      persona_id: Number(this.personaElegida()!.id),
      sub_unidad_id: Number(raw.sub_unidad_id),
      fecha_inicio: raw.fecha_inicio!,
    };
    if (numeroOrden) payload.numero_orden = numeroOrden;
    if (boletin) payload.boletin = boletin;
    const cargo = (raw.posicion_destino ?? '').trim();
    if (cargo) payload.posicion_destino = cargo;
    const numeroDestino = (raw.numero_destino ?? '').trim();
    if (numeroDestino) payload.numero_destino = numeroDestino;
    if (raw.fecha_orden) payload.fecha_orden = raw.fecha_orden;
    if (raw.fecha_boletin) payload.fecha_boletin = raw.fecha_boletin;
    const resolucion = (raw.numero_resolucion ?? '').trim();
    if (resolucion) payload.numero_resolucion = resolucion;
    if (raw.fecha_resolucion) payload.fecha_resolucion = raw.fecha_resolucion;
    const observaciones = (raw.observaciones ?? '').trim();
    if (observaciones) payload.observaciones = observaciones;
    const cierre = (raw.fecha_fin_anterior ?? '').trim();
    if (cierre) payload.fecha_fin_anterior = cierre;

    this.guardando.set(true);
    this.destinosService.crear(payload).subscribe({
      next: (creado) => {
        this.guardando.set(false);
        this.guardado.emit(creado);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(parseError(err));
      },
    });
  }

  cerrar(): void {
    this.cerrado.emit();
  }

  // ── Modo editar: se completa en la Task 7 ───────────────────────────────────

  private precargarEdicion(destino: Destino): void {
    this.form.patchValue({
      sub_unidad_id: destino.sub_unidad?.id ?? '',
      fecha_inicio: destino.fecha_inicio ?? '',
      fecha_fin: destino.fecha_fin ?? '',
      posicion_destino: destino.posicion_destino ?? '',
      numero_orden: destino.numero_orden ?? '',
      boletin: destino.boletin ?? '',
      numero_destino: destino.numero_destino ?? '',
      fecha_orden: fechaTexto(destino.fecha_orden),
      fecha_boletin: fechaTexto(destino.fecha_boletin),
      numero_resolucion: destino.numero_resolucion ?? '',
      fecha_resolucion: fechaTexto(destino.fecha_resolucion),
      observaciones: destino.observaciones ?? '',
    });
  }

  private guardarEdicion(): void {
    const original = this.destino!;
    const raw = this.form.getRawValue();

    const numeroOrden = (raw.numero_orden ?? '').trim();
    const boletin = (raw.boletin ?? '').trim();
    if (!numeroOrden && !boletin) {
      this.error.set('El destino debe conservar al menos el N° de orden o el boletín.');
      return;
    }

    const payload = payloadEdicion(original, {
      fecha_inicio: raw.fecha_inicio ?? '',
      fecha_fin: raw.fecha_fin ?? '',
      posicion_destino: raw.posicion_destino ?? '',
      numero_orden: raw.numero_orden ?? '',
      boletin: raw.boletin ?? '',
      numero_destino: raw.numero_destino ?? '',
      fecha_orden: raw.fecha_orden ?? '',
      fecha_boletin: raw.fecha_boletin ?? '',
      numero_resolucion: raw.numero_resolucion ?? '',
      fecha_resolucion: raw.fecha_resolucion ?? '',
      observaciones: raw.observaciones ?? '',
    });

    if (Object.keys(payload).length === 0) {
      this.cerrado.emit();
      return;
    }

    this.guardando.set(true);
    this.destinosService.editar(original.id, payload).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.guardado.emit(actualizado);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(parseError(err));
      },
    });
  }
}
