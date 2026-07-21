import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ReportesService } from '../../../../core/services/reportes.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  FuenteCatalogo,
  ParametroReporte,
  ResultadoReporte,
} from '../../../../core/models/reportes.models';

@Component({
  selector: 'app-reporte-custom-page',
  standalone: false,
  templateUrl: './reporte-custom-page.html',
  styleUrl: './reporte-custom-page.scss',
})
export class ReporteCustomPage implements OnInit {
  private readonly reportesService = inject(ReportesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly generando = signal(false);
  readonly exportando = signal(false);
  readonly fuentes = signal<FuenteCatalogo[]>([]);
  readonly fuenteClave = signal('');
  readonly columnasSel = signal<Set<string>>(new Set());
  readonly valores = signal<Record<string, string>>({});
  readonly resultado = signal<ResultadoReporte | null>(null);

  readonly fuenteActual = computed(
    () => this.fuentes().find((f) => f.clave === this.fuenteClave()) ?? null,
  );

  ngOnInit(): void {
    this.cargarFuentes();
  }

  cargarFuentes(): void {
    this.cargando.set(true);
    this.reportesService.listarFuentes().subscribe({
      next: (data) => {
        this.fuentes.set(data);
        this.cargando.set(false);
        if (data.length) this.seleccionarFuente(data[0].clave);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.cargando.set(false);
      },
    });
  }

  seleccionarFuente(clave: string): void {
    this.fuenteClave.set(clave);
    const fuente = this.fuentes().find((f) => f.clave === clave);
    this.columnasSel.set(new Set(fuente?.columnas.map((c) => c.clave) ?? []));
    this.valores.set({});
    this.resultado.set(null);
  }

  onFuenteChange(event: Event): void {
    this.seleccionarFuente((event.target as HTMLSelectElement).value);
  }

  toggleColumna(clave: string): void {
    this.columnasSel.update((set) => {
      const next = new Set(set);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  columnaActiva(clave: string): boolean {
    return this.columnasSel().has(clave);
  }

  setValor(clave: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    this.valores.update((v) => ({ ...v, [clave]: target.value }));
  }

  generar(): void {
    if (!this.columnasSel().size) {
      this.toast.error('Elegí al menos una columna');
      return;
    }
    this.generando.set(true);
    this.reportesService.previewCustom(this.payload()).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.generando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.generando.set(false);
      },
    });
  }

  exportar(): void {
    this.exportando.set(true);
    this.reportesService.exportarCustom(this.payload()).subscribe({
      next: (blob) => {
        this.descargar(blob, `${this.fuenteClave()}-personalizado.xlsx`);
        this.exportando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.parseError(err));
        this.exportando.set(false);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/reportes']);
  }

  trackParam = (_: number, p: ParametroReporte) => p.clave;

  private payload() {
    const orden = this.fuenteActual()?.columnas.map((c) => c.clave) ?? [];
    return {
      fuente: this.fuenteClave(),
      columnas: orden.filter((c) => this.columnasSel().has(c)),
      filtros: this.valores(),
    };
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Ocurrió un error al generar el reporte';
  }
}
