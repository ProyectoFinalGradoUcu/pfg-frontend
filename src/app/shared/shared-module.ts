import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PageHeader } from './components/page-header/page-header';
import { EmptyState } from './components/empty-state/empty-state';
import { Select } from './components/select/select';
import { Paginator } from './components/paginator/paginator';

@NgModule({
  declarations: [PageHeader, EmptyState, Select, Paginator],
  imports: [CommonModule, RouterModule],
  exports: [PageHeader, EmptyState, Select, Paginator],
})
export class SharedModule {}
