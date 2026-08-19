import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { UsuariosYRolesRoutingModule } from './usuarios-y-roles-routing-module';
import { UsuariosYRolesPage } from './pages/usuarios-y-roles-page/usuarios-y-roles-page';
import { EditarPermisosRolPage } from './pages/editar-permisos-rol-page/editar-permisos-rol-page';
import { UnidadesPage } from '../unidades/pages/unidades-page/unidades-page';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [UsuariosYRolesPage, EditarPermisosRolPage, UnidadesPage],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    UsuariosYRolesRoutingModule,
  ],
})
export class UsuariosYRolesModule {}
