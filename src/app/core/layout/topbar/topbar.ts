import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: false,
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  /**
   * Unidad que acota lo que el usuario ve, o `null` si su alcance es general.
   * Sin este indicador, alguien con alcance de unidad puede concluir que faltan datos en el
   * sistema cuando en realidad está viendo una porción.
   */
  readonly unidadDeAlcance = this.auth.unidadDeAlcance;

  signOut(): void {
    this.auth.signOut().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => {
        this.auth.clearLocalSession();
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
