import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UnidadesPage } from './pages/unidades-page/unidades-page';

const routes: Routes = [{ path: '', component: UnidadesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UnidadesRoutingModule {}
