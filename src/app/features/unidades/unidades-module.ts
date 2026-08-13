import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { UnidadesRoutingModule } from './unidades-routing-module';
import { UnidadesPage } from './pages/unidades-page/unidades-page';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [UnidadesPage],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, UnidadesRoutingModule],
})
export class UnidadesModule {}
