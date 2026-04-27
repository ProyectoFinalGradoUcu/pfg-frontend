import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthRoutingModule } from './auth-routing-module';
import { LoginPage } from './pages/login-page/login-page';
import { SharedModule } from '../../shared/shared-module';

@NgModule({
  declarations: [LoginPage],
  imports: [CommonModule, AuthRoutingModule, SharedModule],
})
export class AuthModule {}
