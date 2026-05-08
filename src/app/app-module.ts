import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { NotFoundPage } from './features/not-found/pages/not-found-page/not-found-page';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { Sidebar } from './core/layout/sidebar/sidebar';
import { Topbar } from './core/layout/topbar/topbar';
import { ToastContainer } from './core/components/toast-container/toast-container';
import { CoreModule } from './core/core-module';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { authErrorInterceptor } from './core/interceptors/auth-error.interceptor';
import { responseUnwrapInterceptor } from './core/interceptors/response-unwrap.interceptor';

@NgModule({
  declarations: [App, NotFoundPage, MainLayout, Sidebar, Topbar, ToastContainer],
  imports: [BrowserModule, CoreModule, AppRoutingModule],
  exports: [ToastContainer],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withInterceptors([responseUnwrapInterceptor, credentialsInterceptor, authErrorInterceptor]),
    ),
  ],
  bootstrap: [App],
})
export class AppModule {}
