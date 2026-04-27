import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MisionesPage } from './pages/misiones-page/misiones-page';

const routes: Routes = [{ path: '', component: MisionesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MisionesRoutingModule {}