import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared-module';
import { ComisionesPage } from './pages/comisiones-page';

@NgModule({
  declarations: [ComisionesPage],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SharedModule, RouterModule.forChild([
    { path: '', redirectTo: 'asignaciones', pathMatch: 'full' },
    { path: 'asignaciones', component: ComisionesPage },
    { path: 'catalogo', component: ComisionesPage, data: { catalogo: true } },
    { path: 'catalogo/:comisionId', component: ComisionesPage },
  ])],
})
export class ComisionesModule {}
