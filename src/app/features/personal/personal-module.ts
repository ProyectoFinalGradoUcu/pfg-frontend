import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PersonalRoutingModule } from './personal-routing-module';
import { SharedModule } from '../../shared/shared-module';
import { PersonalPage } from './pages/personal-page/personal-page';
import { NuevoPersonalPage } from './pages/nuevo-personal-page/nuevo-personal-page';
import { PersonalDetailPage } from './pages/personal-detail-page/personal-detail-page';
import { FamiliarDetalleModal } from './components/familiar-detalle-modal/familiar-detalle-modal';
import { CargarDocumentoModal } from './components/cargar-documento-modal/cargar-documento-modal';
import { DocumentosPersonal } from './components/documentos-personal/documentos-personal';
import { CambiarSituacionModal } from './components/cambiar-situacion-modal/cambiar-situacion-modal';
import { DestinoFormModalModule } from '../destinos/components/destino-form-modal/destino-form-modal-module';

@NgModule({
  declarations: [
    PersonalPage,
    NuevoPersonalPage,
    PersonalDetailPage,
    FamiliarDetalleModal,
    CargarDocumentoModal,
    DocumentosPersonal,
    CambiarSituacionModal,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    DestinoFormModalModule,
    PersonalRoutingModule,
  ],
})
export class PersonalModule {}
