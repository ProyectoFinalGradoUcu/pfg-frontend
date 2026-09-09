import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CorregirRetiroBody,
  MotivoBajaCatalogo,
  RetiroDetalle,
} from '../../../../core/models/retiros.models';
import { RetirosService } from '../../../../core/services/retiros.service';
import { CatalogosService } from '../../../../core/services/catalogos.service';
import { parseError } from '../../../../shared/utils/parse-error';

/** Valores crudos del formulario. Un string vacío significa "sin valor". */
export interface CamposCorregibles {
  fecha_retiro: string;
  hora_retiro: string;
  motivo_baja_id: number | null;
  motivo: string;
  numero_orden: string;
  boletin: string;
  observaciones: string;
}

/**
 * Solo las claves que cambiaron: una de más rechaza la request entera. Vaciar un
 * texto se expresa con `null`, que no es lo mismo que omitir la clave.
 */
export function payloadCorreccion(
  original: RetiroDetalle,
  valores: CamposCorregibles,
  motivoBajaIdOriginal: number | null,
): CorregirRetiroBody {
  const payload: CorregirRetiroBody = {};

  const fecha = valores.fecha_retiro.trim();
  if (fecha && fecha !== original.fecha_retiro) payload.fecha_retiro = fecha;

  const hora = valores.hora_retiro.trim() || null;
  if (hora !== (original.hora_retiro ?? null)) payload.hora_retiro = hora;

  if (valores.motivo_baja_id !== null && valores.motivo_baja_id !== motivoBajaIdOriginal) {
    payload.motivo_baja_id = valores.motivo_baja_id;
  }

  const textos: [keyof CamposCorregibles & keyof CorregirRetiroBody, string | null][] = [
    ['motivo', original.motivo],
    ['numero_orden', original.numero_orden],
    ['boletin', original.boletin],
    ['observaciones', original.observaciones],
  ];

  for (const [campo, anterior] of textos) {
    const nuevo = (valores[campo] as string).trim() || null;
    // TS no estrecha el valor cuando la clave es una unión.
    if (nuevo !== (anterior ?? null)) payload[campo] = nuevo as never;
  }

  return payload;
}

@Component({
  selector: 'app-corregir-retiro-modal',
  standalone: false,
  templateUrl: './corregir-retiro-modal.html',
  styleUrl: './corregir-retiro-modal.scss',
})
export class CorregirRetiroModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly retirosService = inject(RetirosService);
  private readonly catalogos = inject(CatalogosService);

  @Input({ required: true }) retiro!: RetiroDetalle;

  @Output() corregido = new EventEmitter<RetiroDetalle>();
  @Output() cerrado = new EventEmitter<void>();

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly motivos = signal<MotivoBajaCatalogo[]>([]);

  /** El detalle trae el motivo sin id: se resuelve por código. */
  private motivoBajaIdOriginal: number | null = null;

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

  ngOnInit(): void {
    const r = this.retiro;
    this.form.patchValue({
      fecha_retiro: r.fecha_retiro,
      hora_retiro: r.hora_retiro ?? '',
      motivo: r.motivo ?? '',
      numero_orden: r.numero_orden ?? '',
      boletin: r.boletin ?? '',
      observaciones: r.observaciones ?? '',
    });

    this.catalogos.getMotivosBaja().subscribe({
      next: (motivos) => {
        this.motivos.set(motivos);
        const actual = motivos.find((m) => m.codigo === r.motivo_baja.codigo) ?? null;
        this.motivoBajaIdOriginal = actual?.id ?? null;
        this.form.patchValue({ motivo_baja_id: this.motivoBajaIdOriginal });
      },
    });
  }

  confirmar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = payloadCorreccion(
      this.retiro,
      this.form.getRawValue(),
      this.motivoBajaIdOriginal,
    );

    if (Object.keys(payload).length === 0) {
      this.cerrar();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    this.retirosService.corregir(this.retiro.id, payload).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.corregido.emit(r);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(parseError(err));
      },
    });
  }

  cerrar(): void {
    this.cerrado.emit();
  }
}
