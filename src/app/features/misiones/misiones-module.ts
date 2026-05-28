import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MisionesRoutingModule } from './misiones-routing-module';
import { MisionesPage } from './pages/misiones-page/misiones-page';
import { MisionDetallePage } from './pages/mision-detalle-page/mision-detalle-page';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [MisionesPage, MisionDetallePage],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, MisionesRoutingModule],
})
export class MisionesModule {}