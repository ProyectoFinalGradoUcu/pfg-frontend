import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-not-found-page',
  standalone: false,
  templateUrl: './not-found-page.html',
  styleUrl: './not-found-page.scss',
})
export class NotFoundPage {
  private readonly auth = inject(AuthService);

  // Con sesión la página se dibuja dentro del layout; sin sesión, suelta y con salida al login.
  readonly conSesion = this.auth.isAuthenticated;
  readonly direccion = inject(Router).url;
}
