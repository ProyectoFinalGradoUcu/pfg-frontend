import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { Comando, ComandoCatalogo, SubUnidadConDestinados } from '../../../../core/models/destinos.models';
import { parseError } from '../../../../shared/utils/parse-error';

export type TipoCatalogo = 'comando' | 'base';

/**
 * Alta y edición de un comando (`unidades`) o de una base (`sub_unidades`).
 *
 * Una base siempre se crea dentro de un comando: así no se vuelve a cargar una base
 * como si fuera un comando. El código no se edita porque liquidación y los scripts
 * referencian el catálogo por código. La baja y la reactivación van por la página.
 */
@Component({
  selector: 'app-unidad-form-modal',
  standalone: false,
  templateUrl: './unidad-form-modal.html',
  styleUrl: './unidad-form-modal.scss',
})
export class UnidadFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly catalogosService = inject(CatalogosService);

  @Input({ required: true }) tipo: TipoCatalogo = 'base';
  /** `null` crea; con un comando, lo edita. */
  @Input() comando: ComandoCatalogo | null = null;
  /** `null` crea; con una base, la edita. */
  @Input() base: SubUnidadConDestinados | null = null;
  /** Comandos vigentes para elegir el de la base. */
  @Input() set comandos(value: Comando[]) {
    this.comandosVigentes.set(value ?? []);
  }

  @Output() guardado = new EventEmitter<void>();
  @Output() cerrado = new EventEmitter<void>();

  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  private readonly comandosVigentes = signal<Comando[]>([]);
  readonly comandoOpciones = computed(() =>
    this.comandosVigentes().map((c) => ({ value: c.id, label: `${c.codigo} · ${c.denominacion}` })),
  );

  readonly form = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    denominacion: ['', [Validators.required, Validators.maxLength(150)]],
    unidad_id: [''],
  });

  editando(): boolean {
    return this.tipo === 'comando' ? this.comando !== null : this.base !== null;
  }

  esBase(): boolean {
    return this.tipo === 'base';
  }

  titulo(): string {
    const que = this.esBase() ? 'base' : 'comando';
    return this.editando() ? `Editar ${que}` : this.esBase() ? 'Nueva base' : 'Nuevo comando';
  }

  codigoActual(): string {
    return (this.esBase() ? this.base?.codigo : this.comando?.codigo) ?? '';
  }

  ngOnInit(): void {
    if (this.esBase() && this.base) {
      this.form.patchValue({
        codigo: this.base.codigo,
        denominacion: this.base.denominacion,
        unidad_id: this.base.unidad.id,
      });
      // Si su comando está dado de baja igual tiene que aparecer seleccionado.
      if (!this.comandosVigentes().some((c) => c.id === this.base!.unidad.id)) {
        this.comandosVigentes.update((cs) => [...cs, this.base!.unidad]);
      }
    } else if (!this.esBase() && this.comando) {
      this.form.patchValue({ codigo: this.comando.codigo, denominacion: this.comando.denominacion });
    }
  }

  cerrar(): void {
    this.cerrado.emit();
  }

  guardar(): void {
    this.error.set(null);
    const raw = this.form.getRawValue();
    const codigo = (raw.codigo ?? '').trim().toUpperCase();
    const denominacion = (raw.denominacion ?? '').trim();
    const unidadId = raw.unidad_id ?? '';

    if ((!this.editando() && !codigo) || !denominacion || (this.esBase() && !unidadId)) {
      this.error.set(this.esBase() ? 'Completá código, denominación y comando.' : 'Completá código y denominación.');
      return;
    }

    const op = this.operacion(codigo, denominacion, String(unidadId));
    if (!op) {
      this.cerrado.emit();
      return;
    }

    this.guardando.set(true);
    op.subscribe({
      next: () => {
        this.guardando.set(false);
        this.guardado.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(parseError(err));
      },
    });
  }

  /** `null` cuando la edición no cambió nada. */
  private operacion(codigo: string, denominacion: string, unidadId: string): Observable<unknown> | null {
    if (this.esBase()) {
      if (!this.base) {
        return this.catalogosService.crearBase({ unidad_id: Number(unidadId), codigo, denominacion });
      }
      const payload: { denominacion?: string; unidad_id?: number } = {};
      if (denominacion !== this.base.denominacion) payload.denominacion = denominacion;
      if (unidadId !== this.base.unidad.id) payload.unidad_id = Number(unidadId);
      return Object.keys(payload).length ? this.catalogosService.editarBase(this.base.id, payload) : null;
    }

    if (!this.comando) return this.catalogosService.crearComando({ codigo, denominacion });
    return denominacion !== this.comando.denominacion
      ? this.catalogosService.editarComando(this.comando.id, { denominacion })
      : null;
  }
}
