import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { VuelosRoutingModule } from './vuelos-routing-module';
import { HorasVueloPage } from './pages/horas-vuelo-page/horas-vuelo-page';
import { UnidadesVueloPage } from './pages/unidades-vuelo-page/unidades-vuelo-page';
import { RegistroVueloModal } from './components/registro-vuelo-modal/registro-vuelo-modal';
import { HistorialVueloModal } from './components/historial-vuelo-modal/historial-vuelo-modal';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [HorasVueloPage, UnidadesVueloPage, RegistroVueloModal, HistorialVueloModal],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule, VuelosRoutingModule],
})
export class VuelosModule {}
