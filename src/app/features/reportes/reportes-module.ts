import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportesRoutingModule } from './reportes-routing-module';
import { ReportesPage } from './pages/reportes-page/reportes-page';

@NgModule({
  declarations: [ReportesPage],
  imports: [CommonModule, ReportesRoutingModule],
})
export class ReportesModule {}