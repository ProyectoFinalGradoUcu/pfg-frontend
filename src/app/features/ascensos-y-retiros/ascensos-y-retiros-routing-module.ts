import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AscensosYRetirosPage } from './pages/ascensos-y-retiros-page/ascensos-y-retiros-page';

const routes: Routes = [{ path: '', component: AscensosYRetirosPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AscensosYRetirosRoutingModule {}