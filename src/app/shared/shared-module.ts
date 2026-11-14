import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PageHeader } from './components/page-header/page-header';
import { EmptyState } from './components/empty-state/empty-state';
import { Select } from './components/select/select';
import { Paginator } from './components/paginator/paginator';
import { PanelImpacto } from './components/panel-impacto/panel-impacto';
import { FiltroDerechaNumorComponent } from './components/filtro-derecha-numor/filtro-derecha-numor';
import { SelectorPosicionDerecha } from './components/selector-posicion-derecha/selector-posicion-derecha';
import { SelectorRango } from './components/selector-rango/selector-rango';
import { CargaMasivaModal } from './components/carga-masiva-modal/carga-masiva-modal';
import { SearchInput } from './components/search-input/search-input';
import { ClearFiltersButton } from './components/clear-filters-button/clear-filters-button';
import { DateInput } from './components/date-input/date-input';
import { DocumentoAdjunto } from './components/documento-adjunto/documento-adjunto';

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
    CargaMasivaModal,
    SearchInput,
    ClearFiltersButton,
    DateInput,
    DocumentoAdjunto,
  ],
  imports: [CommonModule, FormsModule, RouterModule],
  exports: [
    PageHeader,
    EmptyState,
    Select,
    Paginator,
    PanelImpacto,
    FiltroDerechaNumorComponent,
    SelectorPosicionDerecha,
    SelectorRango,
    CargaMasivaModal,
    SearchInput,
    ClearFiltersButton,
    DateInput,
    DocumentoAdjunto,
  ],
})
export class SharedModule {}
