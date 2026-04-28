import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CursosRoutingModule } from './cursos-routing-module';
import { CursosPage } from './pages/cursos-page/cursos-page';

@NgModule({
  declarations: [CursosPage],
  imports: [CommonModule, CursosRoutingModule],
})
export class CursosModule {}