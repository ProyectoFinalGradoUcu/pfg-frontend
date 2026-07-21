import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportesRoutingModule } from './reportes-routing-module';
import { ReportesPage } from './pages/reportes-page/reportes-page';
import { ReporteVisorPage } from './pages/reporte-visor-page/reporte-visor-page';
import { ReporteCustomPage } from './pages/reporte-custom-page/reporte-custom-page';
import { ReporteResultado } from './components/reporte-resultado/reporte-resultado';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [ReportesPage, ReporteVisorPage, ReporteCustomPage, ReporteResultado],
  imports: [CommonModule, SharedModule, ReportesRoutingModule],
})
export class ReportesModule {}
