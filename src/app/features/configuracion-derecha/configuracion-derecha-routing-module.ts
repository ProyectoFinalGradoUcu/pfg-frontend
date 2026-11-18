import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfiguracionDerechaPage } from './pages/configuracion-derecha-page/configuracion-derecha-page';

const routes: Routes = [{ path: '', component: ConfiguracionDerechaPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConfiguracionDerechaRoutingModule {}
