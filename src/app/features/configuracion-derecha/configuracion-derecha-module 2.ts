import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared-module';
import { ConfiguracionDerechaRoutingModule } from './configuracion-derecha-routing-module';
import { ConfiguracionDerechaPage } from './pages/configuracion-derecha-page/configuracion-derecha-page';

@NgModule({
  declarations: [ConfiguracionDerechaPage],
  imports: [CommonModule, FormsModule, SharedModule, ConfiguracionDerechaRoutingModule],
})
export class ConfiguracionDerechaModule {}
