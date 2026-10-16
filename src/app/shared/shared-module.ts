import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PageHeader } from './components/page-header/page-header';
import { EmptyState } from './components/empty-state/empty-state';
import { Select } from './components/select/select';
import { Paginator } from './components/paginator/paginator';
import { CargaMasivaModal } from './components/carga-masiva-modal/carga-masiva-modal';

@NgModule({
  declarations: [PageHeader, EmptyState, Select, Paginator, CargaMasivaModal],
  imports: [CommonModule, RouterModule],
  exports: [PageHeader, EmptyState, Select, Paginator, CargaMasivaModal],
})
export class SharedModule {}
