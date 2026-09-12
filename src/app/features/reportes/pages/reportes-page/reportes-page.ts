import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ReportesService } from '../../../../core/services/reportes.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorModalService } from '../../../../core/services/error-modal.service';
import { ReporteCatalogo } from '../../../../core/models/reportes.models';
import { parseError } from '../../../../shared/utils/parse-error';

@Component({
  selector: 'app-reportes-page',
  standalone: false,
  templateUrl: './reportes-page.html',
  styleUrl: './reportes-page.scss',
})
export class ReportesPage implements OnInit {
  private readonly reportesService = inject(ReportesService);
  private readonly toast = inject(ToastService);
  private readonly errorModal = inject(ErrorModalService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly reportes = signal<ReporteCatalogo[]>([]);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.reportesService.listar().subscribe({
      next: (data) => {
        this.reportes.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.reportarError(err);
        this.loading.set(false);
      },
    });
  }

  abrir(reporte: ReporteCatalogo): void {
    this.router.navigate(['/reportes', reporte.clave]);
  }

  /** 403 es bloqueante: se muestra en el modal informativo en vez de un toast que desaparece solo. */
  private reportarError(err: HttpErrorResponse): void {
    const msg = parseError(err);
    if (err.status === 403) this.errorModal.show(msg);
    else this.toast.error(msg);
  }
}
