import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared-module';
import { RetirosRoutingModule } from './retiros-routing-module';
import { RetirosPage } from './pages/retiros-page/retiros-page';
import { RetiroDetallePage } from './pages/retiro-detalle-page/retiro-detalle-page';
import { AnularRetiroModal } from './components/anular-retiro-modal/anular-retiro-modal';
import { CorregirRetiroModal } from './components/corregir-retiro-modal/corregir-retiro-modal';
import { RetiroFormModal } from './components/retiro-form-modal/retiro-form-modal';
import { ReincorporarRetiroModal } from './components/reincorporar-retiro-modal/reincorporar-retiro-modal';
import { DatosCalculoReincorporacionModal } from './components/datos-calculo-reincorporacion-modal/datos-calculo-reincorporacion-modal';

@NgModule({
  declarations: [
    RetirosPage,
    RetiroDetallePage,
    AnularRetiroModal,
    CorregirRetiroModal,
    RetiroFormModal,
    ReincorporarRetiroModal,
    DatosCalculoReincorporacionModal,
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule, RetirosRoutingModule],
})
export class RetirosModule {}
