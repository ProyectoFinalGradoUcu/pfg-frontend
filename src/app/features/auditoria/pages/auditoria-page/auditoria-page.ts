import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuditoriaService } from '../../../../core/services/auditoria.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  AuditoriaFiltroItem,
  AuditoriaRegistro,
} from '../../../../core/models/auditoria.models';
import { SeccionDetalle, formatearDetalle } from '../../detalle-auditoria';

@Component({
  selector: 'app-auditoria-page',
  standalone: false,
  templateUrl: './auditoria-page.html',
  styleUrl: './auditoria-page.scss',
})
export class AuditoriaPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly toast = inject(ToastService);

  readonly registros = signal<AuditoriaRegistro[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly acciones = signal<AuditoriaFiltroItem[]>([]);
  readonly contextos = signal<AuditoriaFiltroItem[]>([]);
  readonly detalleAbierto = signal<AuditoriaRegistro | null>(null);
  readonly detalleSecciones = signal<SeccionDetalle[]>([]);
  readonly mostrarJson = signal(false);

  readonly page = signal(1);
  readonly pageSize = 20;

  readonly filtrosForm = this.fb.group({
    accion: [''],
    contexto: [''],
    desde: [''],
    hasta: [''],
  });

  ngOnInit(): void {
    this.auditoriaService.filtros().subscribe({
      next: (f) => {
        this.acciones.set(f.acciones);
        this.contextos.set(f.contextos);
      },
      error: () => {
        // Los filtros son un extra; si fallan, la tabla sigue funcionando.
      },
    });
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    const { accion, contexto, desde, hasta } = this.filtrosForm.getRawValue();
    this.auditoriaService
      .listar({
        page: this.page(),
        pageSize: this.pageSize,
        accion: accion || undefined,
        contexto: contexto || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      })
      .subscribe({
        next: ({ items, total }) => {
          this.registros.set(items);
          this.total.set(total);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.toast.error(this.parseError(err));
          this.loading.set(false);
        },
      });
  }

  aplicarFiltros(): void {
    this.page.set(1);
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({ accion: '', contexto: '', desde: '', hasta: '' });
    this.page.set(1);
    this.cargar();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.cargar();
  }

  verDetalle(registro: AuditoriaRegistro): void {
    this.detalleAbierto.set(registro);
    this.detalleSecciones.set(formatearDetalle(registro.detalle));
    this.mostrarJson.set(false);
  }

  cerrarDetalle(): void {
    this.detalleAbierto.set(null);
    this.detalleSecciones.set([]);
  }

  toggleJson(): void {
    this.mostrarJson.update((v) => !v);
  }

  soloJson(): boolean {
    return this.detalleSecciones().length === 0;
  }

  detalleJson(detalle: unknown): string {
    if (detalle === null || detalle === undefined) return '—';
    return JSON.stringify(detalle, null, 2);
  }

  trackSeccion = (i: number, s: SeccionDetalle) => `${i}-${s.titulo ?? ''}`;
  trackCampo = (i: number, c: { etiqueta: string }) => `${i}-${c.etiqueta}`;

  trackRegistro = (_: number, r: AuditoriaRegistro) => r.id;

  private parseError(err: HttpErrorResponse): string {
    return err.error?.message ?? err.message ?? 'Error inesperado';
  }
}
