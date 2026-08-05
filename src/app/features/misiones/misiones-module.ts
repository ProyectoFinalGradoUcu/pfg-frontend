import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MisionesRoutingModule } from './misiones-routing-module';
import { MisionesPage } from './pages/misiones-page/misiones-page';
import { MisionConvocatoriasPage } from './pages/mision-convocatorias-page/mision-convocatorias-page';
import { ConvocatoriaDetallePage } from './pages/convocatoria-detalle-page/convocatoria-detalle-page';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [MisionesPage, MisionConvocatoriasPage, ConvocatoriaDetallePage],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule, MisionesRoutingModule],
})
export class MisionesModule {}
