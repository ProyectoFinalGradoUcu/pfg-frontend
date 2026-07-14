import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Sidebar {
  private readonly auth = inject(AuthService);

  collapsed = false;

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
  readonly puedeVerAuditoria = computed(() =>
    this.auth.hasAnyPermiso(['auditoria.ver']),
  );
  readonly puedeVerUsuariosYRoles = computed(() =>
    this.auth.hasAnyPermiso(['usuarios.ver', 'roles.ver']),
  );

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }
}
