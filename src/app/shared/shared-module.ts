import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PageHeader } from './components/page-header/page-header';
import { EmptyState } from './components/empty-state/empty-state';

@NgModule({
  declarations: [PageHeader, EmptyState],
  imports: [CommonModule, RouterModule],
  exports: [PageHeader, EmptyState],
})
export class SharedModule {}
