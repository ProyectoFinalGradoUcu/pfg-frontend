import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../../../shared/shared-module';
import { DestinoFormModal } from './destino-form-modal';

/**
 * El modal de destino va en su propio módulo porque lo usan Destinos y el perfil de la
 * persona. Importar DestinosModule desde Personal traería también sus rutas.
 */
@NgModule({
  declarations: [DestinoFormModal],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule],
  exports: [DestinoFormModal],
})
export class DestinoFormModalModule {}
