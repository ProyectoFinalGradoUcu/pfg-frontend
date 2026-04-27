import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { NotFoundPage } from './features/not-found/pages/not-found-page/not-found-page';

const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard-module').then((m) => m.DashboardModule),
      },
      {
        path: 'personal',
        loadChildren: () => import('./features/personal/personal-module').then((m) => m.PersonalModule),
      },
      {
        path: 'ascensos-y-retiros',
        loadChildren: () => import('./features/ascensos-y-retiros/ascensos-y-retiros-module').then((m) => m.AscensosYRetirosModule),
      },
      {
        path: 'cursos',
        loadChildren: () => import('./features/cursos/cursos-module').then((m) => m.CursosModule),
      },
      {
        path: 'misiones',
        loadChildren: () => import('./features/misiones/misiones-module').then((m) => m.MisionesModule),
      },
      {
        path: 'reportes',
        loadChildren: () => import('./features/reportes/reportes-module').then((m) => m.ReportesModule),
      },
      {
        path: 'usuarios-y-roles',
        loadChildren: () => import('./features/usuarios-y-roles/usuarios-y-roles-module').then((m) => m.UsuariosYRolesModule),
      },
      {
        path: 'auth',
        loadChildren: () => import('./features/auth/auth-module').then((m) => m.AuthModule),
      },
    ],
  },
  {
    path: 'not-found',
    component: NotFoundPage,
  },
  {
    path: '**',
    redirectTo: 'not-found',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}