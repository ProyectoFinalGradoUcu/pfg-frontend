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

  signOut(): void {
    this.auth.signOut().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => {
        this.auth.clearLocalSession();
        this.router.navigate(['/login']);
      },
    });
  }
}
