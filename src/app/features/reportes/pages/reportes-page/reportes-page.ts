import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ReportesService } from '../../../../core/services/reportes.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ReporteCatalogo } from '../../../../core/models/reportes.models';

@Component({
  selector: 'app-reportes-page',
  standalone: false,
  templateUrl: './reportes-page.html',
  styleUrl: './reportes-page.scss',
})
export class ReportesPage implements OnInit {
  private readonly reportesService = inject(ReportesService);
  private readonly toast = inject(ToastService);
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
        this.toast.error(this.parseError(err));
        this.loading.set(false);
      },
    });
  }

  abrir(reporte: ReporteCatalogo): void {
    this.router.navigate(['/reportes', reporte.clave]);
  }

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Ocurrió un error al cargar los reportes';
  }
}
