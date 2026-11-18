import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DestinosRoutingModule } from './destinos-routing-module';
import { AsignacionesPage } from './pages/asignaciones-page/asignaciones-page';
import { UnidadesPage } from './pages/unidades-page/unidades-page';
import { UnidadDetallePage } from './pages/unidad-detalle-page/unidad-detalle-page';
import { UnidadFormModal } from './components/unidad-form-modal/unidad-form-modal';
import { DestinoFormModalModule } from './components/destino-form-modal/destino-form-modal-module';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [AsignacionesPage, UnidadesPage, UnidadDetallePage, UnidadFormModal],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    DestinoFormModalModule,
    DestinosRoutingModule,
  ],
})
export class DestinosModule {}
