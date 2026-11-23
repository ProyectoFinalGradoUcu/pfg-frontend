import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CursosRoutingModule } from './cursos-routing-module';
import { CursosPage } from './pages/cursos-page/cursos-page';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [CursosPage],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule, CursosRoutingModule],
})
export class CursosModule {}
