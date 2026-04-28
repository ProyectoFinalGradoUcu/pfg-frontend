import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AscensosYRetirosRoutingModule } from './ascensos-y-retiros-routing-module';
import { AscensosYRetirosPage } from './pages/ascensos-y-retiros-page/ascensos-y-retiros-page';

@NgModule({
  declarations: [AscensosYRetirosPage],
  imports: [CommonModule, AscensosYRetirosRoutingModule],
})
export class AscensosYRetirosModule {}