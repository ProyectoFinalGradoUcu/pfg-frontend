import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CursosPage } from './pages/cursos-page/cursos-page';

const routes: Routes = [
  { path: '', redirectTo: 'historial', pathMatch: 'full' },
  { path: 'historial', component: CursosPage, data: { section: 'historial' } },
  { path: 'gestion', component: CursosPage, data: { section: 'gestion' } },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CursosRoutingModule {}
