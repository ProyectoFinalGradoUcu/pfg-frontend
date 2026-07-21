import { Component, Input } from '@angular/core';
import { ResultadoReporte, SeccionReporte } from '../../../../core/models/reportes.models';

@Component({
  selector: 'app-reporte-resultado',
  standalone: false,
  templateUrl: './reporte-resultado.html',
  styleUrl: './reporte-resultado.scss',
})
export class ReporteResultado {
  @Input({ required: true }) resultado!: ResultadoReporte;

  secciones(): SeccionReporte[] {
    const res = this.resultado;
    if (res.secciones?.length) return res.secciones;
    return [{ titulo: '', columnas: res.columnas ?? [], filas: res.filas ?? [] }];
  }
}
