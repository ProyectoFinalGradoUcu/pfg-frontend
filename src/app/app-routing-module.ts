import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainLayout } from './core/layout/main-layout/main-layout';
import { NotFoundPage } from './features/not-found/pages/not-found-page/not-found-page';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

const routes: Routes = [
  { path: 'login', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth-module').then((m) => m.AuthModule),
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard-module').then((m) => m.DashboardModule),
      },
      {
        path: 'personal',
        canActivate: [permissionGuard(['personas.ver', 'personas.crear', 'personas.editar', 'personas.eliminar', 'relaciones_laborales.ver', 'relaciones_laborales.gestionar'])],
        loadChildren: () => import('./features/personal/personal-module').then((m) => m.PersonalModule),
      },
      {
        path: 'ascensos-y-retiros',
        canActivate: [permissionGuard(['ascensos.ver', 'ascensos.registrar', 'retiros.ver', 'retiros.registrar'])],
        loadChildren: () => import('./features/ascensos-y-retiros/ascensos-y-retiros-module').then((m) => m.AscensosYRetirosModule),
      },
      {
        path: 'cursos',
        canActivate: [permissionGuard(['cursos.ver', 'cursos.gestionar'])],
        loadChildren: () => import('./features/cursos/cursos-module').then((m) => m.CursosModule),
      },
      {
        path: 'misiones',
        canActivate: [permissionGuard(['misiones.ver', 'misiones.gestionar'])],
        loadChildren: () => import('./features/misiones/misiones-module').then((m) => m.MisionesModule),
      },
      {
        path: 'reportes',
        canActivate: [permissionGuard(['reportes.ejecutar'])],
        loadChildren: () => import('./features/reportes/reportes-module').then((m) => m.ReportesModule),
      },
      {
        path: 'auditoria',
        canActivate: [permissionGuard(['auditoria.ver'])],
        loadChildren: () => import('./features/auditoria/auditoria-module').then((m) => m.AuditoriaModule),
      },
      {
        path: 'unidades',
        canActivate: [permissionGuard(['unidades.ver'])],
        loadChildren: () => import('./features/unidades/unidades-module').then((m) => m.UnidadesModule),
      },
      {
        path: 'usuarios-y-roles',
        canActivate: [permissionGuard(['usuarios.ver', 'roles.ver'])],
        loadChildren: () => import('./features/usuarios-y-roles/usuarios-y-roles-module').then((m) => m.UsuariosYRolesModule),
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
