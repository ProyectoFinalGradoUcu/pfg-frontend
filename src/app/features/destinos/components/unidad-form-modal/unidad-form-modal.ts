import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogosService, payloadEdicionUnidad } from '../../../../core/services/catalogos.service';
import { CrearUnidadPayload, Unidad } from '../../../../core/models/destinos.models';
import { parseError } from '../../../../shared/utils/parse-error';

const TIPO_OPCIONES = [
  { value: 'Unidad', label: 'Unidad' },
  { value: 'Organismo', label: 'Organismo' },
];

@Component({
  selector: 'app-unidad-form-modal',
  standalone: false,
  templateUrl: './unidad-form-modal.html',
  styleUrl: './unidad-form-modal.scss',
})
export class UnidadFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly catalogosService = inject(CatalogosService);

  /** `null` crea una unidad; con una unidad, la edita. */
  @Input() unidad: Unidad | null = null;

  @Output() guardado = new EventEmitter<Unidad>();
  @Output() cerrado = new EventEmitter<void>();

  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly tipoOpciones = TIPO_OPCIONES;

  readonly form = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    denominacion: ['', [Validators.required, Validators.maxLength(150)]],
    tipo: [''],
  });

  /** Método, no `computed()`: ver la nota equivalente en `destino-form-modal`. */
  editando(): boolean {
    return this.unidad !== null;
  }

  ngOnInit(): void {
    if (this.unidad) this.precargarEdicion(this.unidad);
  }

  private precargarEdicion(unidad: Unidad): void {
    this.form.patchValue({
      codigo: unidad.codigo,
      denominacion: unidad.denominacion,
      tipo: unidad.tipo ?? '',
    });
  }

  guardar(): void {
    this.error.set(null);
    if (this.editando()) {
      this.guardarEdicion();
      return;
    }
    this.guardarCreacion();
  }

  cerrar(): void {
    this.cerrado.emit();
  }

  private guardarCreacion(): void {
    const raw = this.form.getRawValue();
    const codigo = (raw.codigo ?? '').trim();
    const denominacion = (raw.denominacion ?? '').trim();
    const tipo = (raw.tipo ?? '').trim();

    if (!codigo || !denominacion) {
      this.error.set('Completá los campos requeridos.');
      return;
    }

    const payload: CrearUnidadPayload = { codigo, denominacion };
    if (tipo) payload.tipo = tipo;

    this.guardando.set(true);
    this.catalogosService.crearUnidad(payload).subscribe({
      next: (creada) => {
        this.guardando.set(false);
        this.guardado.emit(creada);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(parseError(err));
      },
    });
  }

  private guardarEdicion(): void {
    const original = this.unidad!;
    const raw = this.form.getRawValue();
    const denominacion = (raw.denominacion ?? '').trim();

    if (!denominacion) {
      this.error.set('La denominación es obligatoria.');
      return;
    }

    // `vigente` no se toca desde este formulario: se cambia con las acciones dedicadas
    // "Dar de baja" / "Reactivar" de la página, que explican la baja lógica antes de
    // confirmar. Pasarlo sin cambios asegura que nunca aparezca en este diff.
    const payload = payloadEdicionUnidad(original, {
      denominacion,
      tipo: raw.tipo ?? '',
      vigente: original.vigente,
    });

    if (Object.keys(payload).length === 0) {
      this.cerrado.emit();
      return;
    }

    this.guardando.set(true);
    this.catalogosService.editarUnidad(original.id, payload).subscribe({
      next: (actualizada) => {
        this.guardando.set(false);
        this.guardado.emit(actualizada);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(parseError(err));
      },
    });
  }
}
