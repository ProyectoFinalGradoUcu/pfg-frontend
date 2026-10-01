import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { PersonalRoutingModule } from './personal-routing-module';
import { SharedModule } from '../../shared/shared-module';
import { PersonalPage } from './pages/personal-page/personal-page';
import { NuevoPersonalPage } from './pages/nuevo-personal-page/nuevo-personal-page';
import { PersonalDetailPage } from './pages/personal-detail-page/personal-detail-page';
import { FamiliarDetalleModal } from './components/familiar-detalle-modal/familiar-detalle-modal';
import { CargarDocumentoModal } from './components/cargar-documento-modal/cargar-documento-modal';
import { DocumentosPersonal } from './components/documentos-personal/documentos-personal';

@NgModule({
  declarations: [
    PersonalPage,
    NuevoPersonalPage,
    PersonalDetailPage,
    FamiliarDetalleModal,
    CargarDocumentoModal,
    DocumentosPersonal,
  ],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, PersonalRoutingModule],
})
export class PersonalModule {}
