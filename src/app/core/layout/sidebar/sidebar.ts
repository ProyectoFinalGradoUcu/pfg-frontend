import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  collapsed = false;
  readonly cursosExpanded = signal(false);

  readonly puedeVerPersonal = computed(() =>
    this.auth.hasAnyPermiso(['personas.ver', 'personas.crear', 'personas.editar', 'personas.eliminar', 'relaciones_laborales.ver', 'relaciones_laborales.gestionar']),
  );
  readonly puedeVerAscensos = computed(() =>
    this.auth.hasAnyPermiso(['ascensos.ver', 'ascensos.registrar', 'retiros.ver', 'retiros.registrar']),
  );
  readonly puedeVerCursos = computed(() =>
    this.auth.hasAnyPermiso(['cursos.ver', 'cursos.gestionar']),
  );
  readonly puedeVerMisiones = computed(() =>
    this.auth.hasAnyPermiso(['misiones.ver', 'misiones.gestionar']),
  );
  readonly puedeVerReportes = computed(() =>
    this.auth.hasAnyPermiso(['auditoria.ver']),
  );
  readonly puedeVerUsuariosYRoles = computed(() =>
    this.auth.hasAnyPermiso(['usuarios.ver', 'roles.ver']),
  );

  ngOnInit(): void {
    if (this.router.url.startsWith('/cursos')) {
      this.cursosExpanded.set(true);
    }
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects.startsWith('/cursos')) {
          this.cursosExpanded.set(true);
        }
      });
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  toggleCursos(): void {
    this.cursosExpanded.update((v) => !v);
  }
}
