import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MisionesPage } from './pages/misiones-page/misiones-page';
import { MisionConvocatoriasPage } from './pages/mision-convocatorias-page/mision-convocatorias-page';
import { ConvocatoriaDetallePage } from './pages/convocatoria-detalle-page/convocatoria-detalle-page';

const routes: Routes = [
  { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
  { path: 'catalogo', component: MisionesPage, data: { section: 'catalogo' } },
  { path: 'personal', component: MisionesPage, data: { section: 'personal-en-mision' } },
  { path: 'catalogo/:misionId', component: MisionConvocatoriasPage },
  {
    path: 'catalogo/:misionId/convocatorias/:convocatoriaId',
    component: ConvocatoriaDetallePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MisionesRoutingModule {}
