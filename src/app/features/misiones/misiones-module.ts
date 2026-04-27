import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MisionesRoutingModule } from './misiones-routing-module';
import { MisionesPage } from './pages/misiones-page/misiones-page';

@NgModule({
  declarations: [MisionesPage],
  imports: [CommonModule, MisionesRoutingModule],
})
export class MisionesModule {}