import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PageHeader } from './components/page-header/page-header';
import { EmptyState } from './components/empty-state/empty-state';
import { Select } from './components/select/select';
import { Paginator } from './components/paginator/paginator';
import { PanelImpacto } from './components/panel-impacto/panel-impacto';
import { FiltroDerechaNumorComponent } from './components/filtro-derecha-numor/filtro-derecha-numor';
import { SelectorPosicionDerecha } from './components/selector-posicion-derecha/selector-posicion-derecha';
import { SelectorRango } from './components/selector-rango/selector-rango';

@NgModule({
  declarations: [
    PageHeader,
    EmptyState,
    Select,
    Paginator,
    PanelImpacto,
    FiltroDerechaNumorComponent,
    SelectorPosicionDerecha,
    SelectorRango,
  ],
  imports: [CommonModule, RouterModule],
  exports: [
    PageHeader,
    EmptyState,
    Select,
    Paginator,
    PanelImpacto,
    FiltroDerechaNumorComponent,
    SelectorPosicionDerecha,
    SelectorRango,
  ],
})
export class SharedModule {}
