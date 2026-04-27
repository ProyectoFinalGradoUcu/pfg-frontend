import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { NotFoundPage } from './features/not-found/pages/not-found-page/not-found-page';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { CoreModule } from './core/core-module';

@NgModule({
  declarations: [App, NotFoundPage, MainLayout],
  imports: [BrowserModule, CoreModule, AppRoutingModule],
  providers: [provideBrowserGlobalErrorListeners()],
  bootstrap: [App],
})
export class AppModule {}
