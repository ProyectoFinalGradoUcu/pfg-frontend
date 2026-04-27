import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsuariosYRolesRoutingModule } from './usuarios-y-roles-routing-module';
import { UsuariosYRolesPage } from './pages/usuarios-y-roles-page/usuarios-y-roles-page';

@NgModule({
  declarations: [UsuariosYRolesPage],
  imports: [CommonModule, UsuariosYRolesRoutingModule],
})
export class UsuariosYRolesModule {}