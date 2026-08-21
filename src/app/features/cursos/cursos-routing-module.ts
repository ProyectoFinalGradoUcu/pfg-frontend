import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CursosPage } from './pages/cursos-page/cursos-page';

const routes: Routes = [
  { path: '', redirectTo: 'inscripciones', pathMatch: 'full' },
  { path: 'inscripciones', component: CursosPage, data: { section: 'inscripciones' } },
  { path: 'catalogo',      component: CursosPage, data: { section: 'catalogo' } },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CursosRoutingModule {}
