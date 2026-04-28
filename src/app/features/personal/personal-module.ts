import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonalRoutingModule } from './personal-routing-module';
import { PersonalPage } from './pages/personal-page/personal-page';

@NgModule({
  declarations: [PersonalPage],
  imports: [CommonModule, PersonalRoutingModule],
})
export class PersonalModule {}