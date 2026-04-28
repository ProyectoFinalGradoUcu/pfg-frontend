import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsuariosYRolesPage } from './pages/usuarios-y-roles-page/usuarios-y-roles-page';

const routes: Routes = [{ path: '', component: UsuariosYRolesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UsuariosYRolesRoutingModule {}