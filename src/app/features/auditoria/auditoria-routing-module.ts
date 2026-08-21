import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuditoriaPage } from './pages/auditoria-page/auditoria-page';

const routes: Routes = [{ path: '', component: AuditoriaPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuditoriaRoutingModule {}
