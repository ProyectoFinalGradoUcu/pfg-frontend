import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RetirosPage } from './pages/retiros-page/retiros-page';
import { RetiroDetallePage } from './pages/retiro-detalle-page/retiro-detalle-page';

// El detalle es ruta propia para que el link se pueda compartir y aguante F5.
const routes: Routes = [
  { path: '', component: RetirosPage },
  { path: ':retiroId', component: RetiroDetallePage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RetirosRoutingModule {}
