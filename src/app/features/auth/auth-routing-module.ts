import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginPage } from './pages/login-page/login-page';
import { guestGuard } from '../../core/guards/guest.guard';

const routes: Routes = [
  {
    path: '',
    component: LoginPage,
    canActivate: [guestGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthRoutingModule {}
