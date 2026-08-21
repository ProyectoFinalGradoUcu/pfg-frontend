import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: false,
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  token = '';

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      passwordNueva: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', Validators.required],
    },
    {
      validators: (group: AbstractControl) => {
        const pw = group.get('passwordNueva')?.value;
        const confirm = group.get('confirmar')?.value;
        return pw && confirm && pw !== confirm ? { mismatch: true } : null;
      },
    },
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.router.navigate(['/auth/forgot-password']);
    }
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    const { passwordNueva } = this.form.getRawValue();
    this.auth.resetPassword({ token: this.token, passwordNueva: passwordNueva! }).subscribe({
      next: () => {
        this.router.navigate(['/auth/login'], {
          queryParams: { mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.service_response?.service_status?.http_message ??
          'El link es inválido o ya expiró.',
        );
      },
    });
  }
}
