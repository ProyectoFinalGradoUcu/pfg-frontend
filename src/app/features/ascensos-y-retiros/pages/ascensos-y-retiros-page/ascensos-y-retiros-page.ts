import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AscensosService } from '../../../../core/services/ascensos.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  EstadisticasAscensos,
  OrdenAscenso,
  ResumenAscensos,
} from '../../../../core/models/ascensos.models';
import { parseError } from '../../../../shared/utils/parse-error';

/** Panorama del módulo: pasibles, cursos que frenan, pirámide y últimas órdenes. */
@Component({
  selector: 'app-ascensos-y-retiros-page',
  standalone: false,
  templateUrl: './ascensos-y-retiros-page.html',
  styleUrl: './ascensos-y-retiros-page.scss',
})
export class AscensosYRetirosPage implements OnInit {
  private readonly svc = inject(AscensosService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly resumen = signal<ResumenAscensos | null>(null);
  readonly estadisticas = signal<EstadisticasAscensos | null>(null);
  readonly ultimasOrdenes = signal<OrdenAscenso[]>([]);

  readonly puedeVerAscensos = computed(() =>
    this.auth.hasAnyPermiso(['ascensos.ver', 'ascensos.ver.unidad']),
  );
  readonly puedeVerReglas = computed(() =>
    this.auth.hasAnyPermiso(['reglas_ascenso.ver', 'reglas_ascenso.gestionar']),
  );
  readonly puedeRegistrar = computed(() => this.auth.hasPermiso('ascensos.registrar'));

  /** Dotación más alta, para dibujar las barras en proporción. */
  readonly maximoPiramide = computed(() =>
    Math.max(1, ...(this.estadisticas()?.piramide ?? []).map((p) => p.dotacion)),
  );

  readonly anioActual = new Date().getFullYear();

  ngOnInit(): void {
    if (!this.puedeVerAscensos()) {
      this.loading.set(false);
      return;
    }
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.svc.getResumen().subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(parseError(err));
      },
    });

    // Complementarios: si fallan, el panorama igual muestra lo principal.
    this.svc
      .getEstadisticas({ anio_desde: this.anioActual, anio_hasta: this.anioActual })
      .subscribe({
        next: (e) => this.estadisticas.set(e),
        error: () => this.estadisticas.set(null),
      });

    this.svc.listarOrdenes({ pageSize: 5 }).subscribe({
      next: (o) => this.ultimasOrdenes.set(o.items),
      error: () => this.ultimasOrdenes.set([]),
    });
  }

  anchoBarra(dotacion: number): string {
    return `${Math.round((dotacion / this.maximoPiramide()) * 100)}%`;
  }
}
