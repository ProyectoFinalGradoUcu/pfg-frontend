import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AscensosYRetirosRoutingModule } from './ascensos-y-retiros-routing-module';
import { AscensosYRetirosPage } from './pages/ascensos-y-retiros-page/ascensos-y-retiros-page';
import { ReglasPage } from './pages/reglas-page/reglas-page';
import { PasiblesPage } from './pages/pasibles-page/pasibles-page';
import { NuevaOrdenPage } from './pages/nueva-orden-page/nueva-orden-page';
import { OrdenesPage } from './pages/ordenes-page/ordenes-page';
import { OrdenDetallePage } from './pages/orden-detalle-page/orden-detalle-page';
import { ReglaFormModal } from './components/regla-form-modal/regla-form-modal';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [
    AscensosYRetirosPage,
    ReglasPage,
    PasiblesPage,
    NuevaOrdenPage,
    OrdenesPage,
    OrdenDetallePage,
    ReglaFormModal,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    AscensosYRetirosRoutingModule,
  ],
})
export class AscensosYRetirosModule {}
