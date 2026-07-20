import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuditoriaRoutingModule } from './auditoria-routing-module';
import { AuditoriaPage } from './pages/auditoria-page/auditoria-page';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [AuditoriaPage],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    AuditoriaRoutingModule,
  ],
})
export class AuditoriaModule {}
