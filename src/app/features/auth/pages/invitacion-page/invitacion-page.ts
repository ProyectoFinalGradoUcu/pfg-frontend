import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InvitacionesService } from '../../../../core/services/invitaciones.service';

@Component({
  selector: 'app-invitacion-page',
  standalone: false,
  templateUrl: './invitacion-page.html',
  styleUrl: './invitacion-page.scss',
})
export class InvitacionPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invitacionesService = inject(InvitacionesService);

  token = '';

  readonly verificando = signal(true);
  readonly tokenError = signal<string | null>(null);
  readonly emailVerificado = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmar: ['', Validators.required],
    },
    {
      validators: (group: AbstractControl) => {
        const pw = group.get('password')?.value;
        const confirm = group.get('confirmar')?.value;
        return pw && confirm && pw !== confirm ? { mismatch: true } : null;
      },
    },
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.tokenError.set('No se encontró el token de invitación.');
      this.verificando.set(false);
      return;
    }
    this.invitacionesService.verificar(this.token).subscribe({
      next: (res) => {
        this.verificando.set(false);
        if (!res?.email) {
          this.tokenError.set('La invitación es inválida o ya fue utilizada.');
        } else {
          this.emailVerificado.set(res.email);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.verificando.set(false);
        this.tokenError.set(this.parseError(err));
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    const { password } = this.form.getRawValue();
    this.invitacionesService
      .aceptar({ token: this.token, password: password! })
      .subscribe({
        next: () => {
          this.router.navigate(['/auth/login'], {
            queryParams: { mensaje: 'Registro completado. Ya podés iniciar sesión.' },
          });
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(this.parseError(err));
        },
      });
  }

  private parseError(err: HttpErrorResponse): string {
    return (
      err.error?.service_response?.service_status?.http_message ??
      'Error inesperado. Intentá nuevamente'
    );
  }
}
