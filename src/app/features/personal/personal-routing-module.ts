import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NuevoPersonalPage } from './pages/nuevo-personal-page/nuevo-personal-page';
import { PersonalDetailPage } from './pages/personal-detail-page/personal-detail-page';
import { PersonalPage } from './pages/personal-page/personal-page';
import { permissionGuard } from '../../core/guards/permission.guard';

const routes: Routes = [
  { path: '', component: PersonalPage },
  { path: 'nuevo', component: NuevoPersonalPage },
  {
    path: 'configuracion-derecha',
    canActivate: [permissionGuard(['derecha.gestionar'])],
    loadChildren: () =>
      import('../configuracion-derecha/configuracion-derecha-module').then((m) => m.ConfiguracionDerechaModule),
  },
  { path: ':id', component: PersonalDetailPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PersonalRoutingModule {}
