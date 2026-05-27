import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MisionesPage } from './pages/misiones-page/misiones-page';
import { MisionDetallePage } from './pages/mision-detalle-page/mision-detalle-page';

const routes: Routes = [
  { path: '', redirectTo: 'historial', pathMatch: 'full' },
  { path: 'historial', component: MisionesPage, data: { section: 'historial' } },
  { path: 'gestion', component: MisionesPage, data: { section: 'gestion' } },
  { path: 'gestion/:id', component: MisionDetallePage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MisionesRoutingModule {}
