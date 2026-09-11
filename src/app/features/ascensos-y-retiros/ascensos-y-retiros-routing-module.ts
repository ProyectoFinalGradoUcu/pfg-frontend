import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReglasPage } from './pages/reglas-page/reglas-page';
import { PasiblesPage } from './pages/pasibles-page/pasibles-page';
import { NuevaOrdenPage } from './pages/nueva-orden-page/nueva-orden-page';
import { OrdenesPage } from './pages/ordenes-page/ordenes-page';
import { OrdenDetallePage } from './pages/orden-detalle-page/orden-detalle-page';
import { permissionGuard } from '../../core/guards/permission.guard';

const routes: Routes = [
  { path: '', redirectTo: 'pasibles', pathMatch: 'full' },
  {
    path: 'pasibles',
    canActivate: [permissionGuard(['ascensos.ver'])],
    component: PasiblesPage,
  },
  {
    path: 'ordenes',
    canActivate: [permissionGuard(['ascensos.ver'])],
    component: OrdenesPage,
  },
  {
    // Va antes de 'ordenes/:id' para que 'nueva' no se tome como un id.
    path: 'ordenes/nueva',
    canActivate: [permissionGuard(['ascensos.registrar'])],
    component: NuevaOrdenPage,
  },
  {
    path: 'ordenes/:id',
    canActivate: [permissionGuard(['ascensos.ver'])],
    component: OrdenDetallePage,
  },
  {
    path: 'reglas',
    canActivate: [permissionGuard(['reglas_ascenso.ver', 'reglas_ascenso.gestionar'])],
    component: ReglasPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AscensosYRetirosRoutingModule {}
