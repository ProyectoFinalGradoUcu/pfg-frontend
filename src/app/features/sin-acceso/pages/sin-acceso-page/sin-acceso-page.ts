import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-sin-acceso-page',
  standalone: false,
  templateUrl: './sin-acceso-page.html',
  styleUrl: './sin-acceso-page.scss',
})
export class SinAccesoPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly roles = computed(() => this.user()?.roles ?? []);

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
