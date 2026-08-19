import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AsignacionesPage } from './pages/asignaciones-page/asignaciones-page';
import { UnidadesPage } from './pages/unidades-page/unidades-page';
import { UnidadDetallePage } from './pages/unidad-detalle-page/unidad-detalle-page';

const routes: Routes = [
  { path: '', redirectTo: 'asignaciones', pathMatch: 'full' },
  { path: 'asignaciones', component: AsignacionesPage },
  { path: 'unidades', component: UnidadesPage },
  { path: 'unidades/:unidadId', component: UnidadDetallePage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DestinosRoutingModule {}
