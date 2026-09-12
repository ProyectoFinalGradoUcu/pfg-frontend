import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ReportesService } from '../../../../core/services/reportes.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import {
  ParametroReporte,
  ReporteCatalogo,
  ResultadoReporte,
} from '../../../../core/models/reportes.models';
import { parseError } from '../../../../shared/utils/parse-error';

@Component({
  selector: 'app-reporte-visor-page',
  standalone: false,
  templateUrl: './reporte-visor-page.html',
  styleUrl: './reporte-visor-page.scss',
})
export class ReporteVisorPage implements OnInit {
  private readonly reportesService = inject(ReportesService);
  private readonly toast = inject(ToastService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private clave = '';

  readonly cargandoDef = signal(false);
  readonly generando = signal(false);
  readonly exportando = signal(false);
  readonly definicion = signal<ReporteCatalogo | null>(null);
  readonly resultado = signal<ResultadoReporte | null>(null);
  readonly valores = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.clave = this.route.snapshot.paramMap.get('clave') ?? '';
    this.cargarDefinicion();
  }

  cargarDefinicion(): void {
    this.cargandoDef.set(true);
    this.reportesService.obtenerDefinicion(this.clave).subscribe({
      next: (def) => {
        this.definicion.set(def);
        const iniciales: Record<string, string> = {};
        for (const p of def.parametros) {
          if (p.valorPorDefecto !== undefined) iniciales[p.clave] = String(p.valorPorDefecto);
        }
        this.valores.set(iniciales);
        this.cargandoDef.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.reportarError(err);
        this.cargandoDef.set(false);
      },
    });
  }

  setValor(clave: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    this.valores.update((v) => ({ ...v, [clave]: target.value }));
  }

  generar(): void {
    this.generando.set(true);
    this.reportesService.preview(this.clave, this.valores()).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.generando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.reportarError(err);
        this.generando.set(false);
      },
    });
  }

  exportar(): void {
    this.exportando.set(true);
    this.reportesService.exportarXlsx(this.clave, this.valores()).subscribe({
      next: (blob) => {
        this.descargar(blob, `${this.clave}.xlsx`);
        this.exportando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.reportarError(err);
        this.exportando.set(false);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/reportes']);
  }

  trackParam = (_: number, p: ParametroReporte) => p.clave;

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 403 es bloqueante: se muestra en el modal informativo en vez de un toast que desaparece solo. */
  private reportarError(err: HttpErrorResponse): void {
    const msg = parseError(err);
    if (err.status === 403) this.errorModal.show(msg);
    else this.toast.error(msg);
  }
}
