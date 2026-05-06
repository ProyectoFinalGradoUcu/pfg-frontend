import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly auth = inject(AuthService);

  collapsed = false;

  readonly puedeVerUsuariosYRoles = computed(() =>
    this.auth.hasAnyPermiso(['usuarios.ver', 'roles.ver']),
  );

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }
}
