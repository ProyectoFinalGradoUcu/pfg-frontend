import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';

import { PersonalService } from '../../core/services/personal.service';
import { PersonaListItem } from '../../core/models/personal.models';
import { ESPERA_BUSQUEDA_MS } from './espera-busqueda';

export const DEBOUNCE_BUSQUEDA_MS = ESPERA_BUSQUEDA_MS;
const TAMANO_PAGINA = 20;

export interface OpcionPersona extends PersonaListItem {
  etiqueta: string;
}

/**
 * Alimenta un `app-select` con `remoteSearch`: busca en el servidor por cédula, nombre o
 * apellido. Se crea en un inicializador de campo del componente (usa `inject`).
 */
export class BuscadorPersonas {
  private readonly personal = inject(PersonalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly termino$ = new Subject<string>();
  private readonly resultados = signal<PersonaListItem[]>([]);
  // El app-select solo muestra la etiqueta de lo elegido si está entre sus items.
  private readonly elegidas = signal<PersonaListItem[]>([]);

  readonly buscando = signal(false);

  readonly opciones = computed<OpcionPersona[]>(() => {
    const elegidas = this.elegidas();
    const ids = new Set(elegidas.map((p) => p.id));
    return [...elegidas, ...this.resultados().filter((p) => !ids.has(p.id))].map((p) => ({
      ...p,
      etiqueta: `${p.nombre} · CI ${p.cedula}`,
    }));
  });

  constructor() {
    this.termino$
      .pipe(
        debounceTime(DEBOUNCE_BUSQUEDA_MS),
        switchMap((texto) =>
          this.personal
            .findPaginado({ search: texto.trim() || undefined, pageSize: TAMANO_PAGINA })
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.resultados.set(res?.items ?? []);
        this.buscando.set(false);
      });
  }

  buscar(texto: string): void {
    this.buscando.set(true);
    this.termino$.next(texto);
  }

  /** Recibe el valor del control (un id o varios) y conserva a esas personas en las opciones. */
  recordar(valor: string | string[] | null | undefined): void {
    const ids = valor == null || valor === '' ? [] : Array.isArray(valor) ? valor : [valor];
    const conocidas = [...this.elegidas(), ...this.resultados()];
    this.elegidas.set(
      ids
        .map((id) => conocidas.find((p) => p.id === id))
        .filter((p): p is PersonaListItem => !!p),
    );
  }

  vincular(control: AbstractControl<string | string[] | null>): void {
    control.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => this.recordar(valor));
  }

  persona(id: string | null | undefined): PersonaListItem | null {
    if (!id) return null;
    return (
      this.elegidas().find((p) => p.id === id) ?? this.resultados().find((p) => p.id === id) ?? null
    );
  }
}
