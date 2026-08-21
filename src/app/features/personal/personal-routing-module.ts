import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NuevoPersonalPage } from './pages/nuevo-personal-page/nuevo-personal-page';
import { PersonalDetailPage } from './pages/personal-detail-page/personal-detail-page';
import { PersonalPage } from './pages/personal-page/personal-page';

const routes: Routes = [
  { path: '', component: PersonalPage },
  { path: 'nuevo', component: NuevoPersonalPage },
  { path: ':id', component: PersonalDetailPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PersonalRoutingModule {}
