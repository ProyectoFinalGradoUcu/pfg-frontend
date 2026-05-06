import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: false,
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.email, Validators.maxLength(60)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = false;
  errorMessage: string | null = null;

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    const { username, password } = this.form.getRawValue();
    this.auth.signIn({ username: username!, password: password! }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.parseError(err);
      },
    });
  }

  private parseError(err: HttpErrorResponse): string {
    if (err.status === 401) return 'Usuario o contraseña incorrectos';
    if (err.status === 429) return 'Demasiados intentos. Intentá en unos minutos';
    if (err.status === 0) return 'No se pudo conectar con el servidor';
    return 'Error inesperado. Intentá nuevamente';
  }
}
