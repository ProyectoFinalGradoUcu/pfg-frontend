import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsuariosYRolesPage } from './pages/usuarios-y-roles-page/usuarios-y-roles-page';
import { EditarPermisosRolPage } from './pages/editar-permisos-rol-page/editar-permisos-rol-page';
import { permissionGuard } from '../../core/guards/permission.guard';

const routes: Routes = [
  { path: '', component: UsuariosYRolesPage },
  {
    path: 'roles/:id/permisos',
    component: EditarPermisosRolPage,
    canActivate: [permissionGuard(['roles.gestionar'])],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UsuariosYRolesRoutingModule {}
