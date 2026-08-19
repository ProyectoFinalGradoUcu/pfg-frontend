import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared-module';

/**
 * Módulo legacy — la UnidadesPage ahora vive dentro de UsuariosYRolesModule
 * como una pestaña más. Este módulo se mantiene vacío por si hay imports residuales.
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
})
export class UnidadesModule {}
