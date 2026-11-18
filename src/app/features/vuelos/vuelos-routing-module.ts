import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HorasVueloPage } from './pages/horas-vuelo-page/horas-vuelo-page';
import { UnidadesVueloPage } from './pages/unidades-vuelo-page/unidades-vuelo-page';

const routes: Routes = [
  { path: '', redirectTo: 'horas', pathMatch: 'full' },
  { path: 'horas', component: HorasVueloPage },
  { path: 'unidades', component: UnidadesVueloPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VuelosRoutingModule {}
