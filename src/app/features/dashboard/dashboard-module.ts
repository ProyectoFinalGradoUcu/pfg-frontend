import { NgModule } from '@angular/core';
import { DashboardRoutingModule } from './dashboard-routing-module';
import { DashboardPage } from './pages/dashboard-page/dashboard-page';

@NgModule({
  declarations: [DashboardPage],
  imports: [DashboardRoutingModule],
})
export class DashboardModule {}
