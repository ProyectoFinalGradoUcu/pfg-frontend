import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DestinosRoutingModule } from './destinos-routing-module';
import { AsignacionesPage } from './pages/asignaciones-page/asignaciones-page';
import { UnidadesPage } from './pages/unidades-page/unidades-page';
import { UnidadDetallePage } from './pages/unidad-detalle-page/unidad-detalle-page';
import { DestinoFormModal } from './components/destino-form-modal/destino-form-modal';
import { UnidadFormModal } from './components/unidad-form-modal/unidad-form-modal';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [AsignacionesPage, UnidadesPage, UnidadDetallePage, DestinoFormModal, UnidadFormModal],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule, DestinosRoutingModule],
})
export class DestinosModule {}
