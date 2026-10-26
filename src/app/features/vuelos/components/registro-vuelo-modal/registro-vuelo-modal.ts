import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { VuelosService } from '../../../../core/services/vuelos.service';
import { EditarRegistroVueloPayload, RegistroVuelo, UnidadVuelo } from '../../../../core/models/vuelos.models';
import { parseError } from '../../../../shared/utils/parse-error';
import { formatoHoras } from '../../horas';

export interface RegistroGuardado {
  registro: RegistroVuelo;
  /** Pasar a la fila siguiente en vez de cerrar. */
  siguiente: boolean;
}

type CampoHoras = 'hs_av_anio_militar' | 'hs_av_total' | 'hs_ob_anio_militar' | 'hs_ob_total';
const CAMPOS_HORAS: CampoHoras[] = ['hs_av_anio_militar', 'hs_av_total', 'hs_ob_anio_militar', 'hs_ob_total'];

/** `''` es "sin valor"; acepta coma decimal como en el Excel. `NaN` si no es un número. */
export function parseHoras(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || String(valor).trim() === '') return 0;
  return Number(String(valor).trim().replace(',', '.'));
}

const redondear = (n: number) => Math.round(n * 10) / 10;

@Component({
  selector: 'app-registro-vuelo-modal',
  standalone: false,
  templateUrl: './registro-vuelo-modal.html',
  styleUrl: './registro-vuelo-modal.scss',
})
export class RegistroVueloModal implements OnChanges, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly vuelosService = inject(VuelosService);

  @Input({ required: true }) registro!: RegistroVuelo;
  @Input() unidades: UnidadVuelo[] = [];
  @Input() haySiguiente = false;

  @Output() guardado = new EventEmitter<RegistroGuardado>();
  @Output() cerrado = new EventEmitter<void>();

  @ViewChild('primerCampo') primerCampo?: ElementRef<HTMLInputElement>;

  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly form = this.fb.nonNullable.group({
    unidad_vuelo_id: this.fb.control<string | null>(null),
    aeronaves: '',
    hs_av_anio_militar: '',
    hs_av_total: '',
    hs_ob_anio_militar: '',
    hs_ob_total: '',
  });

  /** Vigentes, más la actual aunque esté dada de baja, para no perderla al abrir. */
  opcionesUnidad: { value: string; label: string }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['registro'] || changes['unidades']) {
      const actual = this.registro.unidad_vuelo?.id;
      this.opcionesUnidad = this.unidades
        .filter((u) => u.vigente || u.id === actual)
        .map((u) => ({ value: u.id, label: u.vigente ? u.denominacion : `${u.denominacion} (baja)` }));
    }
    if (changes['registro']) {
      const r = this.registro;
      this.form.reset({
        unidad_vuelo_id: r.unidad_vuelo?.id ?? null,
        aeronaves: r.aeronaves ?? '',
        hs_av_anio_militar: String(r.hs_av_anio_militar),
        hs_av_total: String(r.hs_av_total),
        hs_ob_anio_militar: String(r.hs_ob_anio_militar),
        hs_ob_total: String(r.hs_ob_total),
      });
      this.error.set(null);
      if (!changes['registro'].firstChange) this.enfocar();
    }
  }

  ngAfterViewInit(): void {
    this.enfocar();
  }

  private enfocar(): void {
    setTimeout(() => this.primerCampo?.nativeElement.select());
  }

  readonly formatoHoras = formatoHoras;

  /** Total con lo que está escrito: la suma de las 4 columnas, igual que en la tabla. */
  total(): number | null {
    const v = this.form.getRawValue();
    const valores = CAMPOS_HORAS.map((campo) => parseHoras(v[campo]));
    return valores.some(Number.isNaN) ? null : redondear(valores.reduce((a, b) => a + b, 0));
  }

  guardar(siguiente: boolean): void {
    this.error.set(null);
    const v = this.form.getRawValue();

    const valores = {} as Record<CampoHoras, number>;
    for (const campo of CAMPOS_HORAS) {
      const n = parseHoras(v[campo]);
      if (Number.isNaN(n) || n < 0) {
        this.error.set('Las horas tienen que ser números mayores o iguales a cero.');
        return;
      }
      if (redondear(n) !== n) {
        this.error.set('Las horas admiten hasta un decimal.');
        return;
      }
      valores[campo] = n;
    }

    const r = this.registro;
    const payload: EditarRegistroVueloPayload = {};
    const unidad = v.unidad_vuelo_id || null;
    if (unidad !== (r.unidad_vuelo?.id ?? null)) payload.unidad_vuelo_id = unidad === null ? null : Number(unidad);
    const aeronaves = v.aeronaves.trim() || null;
    if (aeronaves !== (r.aeronaves ?? null)) payload.aeronaves = aeronaves;
    for (const campo of CAMPOS_HORAS) {
      if (valores[campo] !== r[campo]) payload[campo] = valores[campo];
    }

    // Sin cambios, una fila nunca editada igual se guarda: confirma que se revisó ("0 horas").
    if (Object.keys(payload).length === 0 && r.editado_en) {
      this.guardado.emit({ registro: r, siguiente });
      return;
    }

    this.guardando.set(true);
    this.vuelosService.editarRegistro(r.id, payload).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.guardado.emit({ registro: actualizado, siguiente });
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
}
