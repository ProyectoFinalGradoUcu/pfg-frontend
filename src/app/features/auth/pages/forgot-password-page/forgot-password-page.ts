import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: false,
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.email]],
  });

  readonly loading = signal(false);
  readonly submitted = signal(false);

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    const { username } = this.form.getRawValue();
    this.auth.forgotPassword(username!).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
      error: () => {
        // Siempre mostrar el mismo mensaje (no revelar si el usuario existe)
        this.loading.set(false);
        this.submitted.set(true);
      },
    });
  }
}
