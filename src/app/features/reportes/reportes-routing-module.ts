import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportesPage } from './pages/reportes-page/reportes-page';
import { ReporteVisorPage } from './pages/reporte-visor-page/reporte-visor-page';
import { ReporteCustomPage } from './pages/reporte-custom-page/reporte-custom-page';

const routes: Routes = [
  { path: '', component: ReportesPage },
  { path: 'personalizado', component: ReporteCustomPage },
  { path: ':clave', component: ReporteVisorPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportesRoutingModule {}
