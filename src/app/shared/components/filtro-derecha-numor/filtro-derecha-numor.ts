import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import {
  DireccionOrden,
  EscalaDerecha,
  FILTRO_DERECHA_NUMOR_INICIAL,
  FiltroDerechaNumor,
  NOMBRES_ESCALA,
  hayFiltroDerechaNumor,
  OrdenarPorDerechaNumor,
} from '../../../core/models/derecha.models';
import { GradoItem, OpcionSelect } from '../../../core/models/personal.models';
import { PersonalService } from '../../../core/services/personal.service';

/**
 * Filtro (y opcionalmente orden) por derecha y numor. Emite un objeto con la forma
 * de `FiltroDerechaNumorDto`: personal, inscripciones y reportes mandan lo mismo.
 */
@Component({
  selector: 'app-filtro-derecha-numor',
  standalone: false,
  templateUrl: './filtro-derecha-numor.html',
  styleUrl: './filtro-derecha-numor.scss',
})
export class FiltroDerechaNumorComponent implements OnInit {
  private readonly personal = inject(PersonalService);

  @Input() set valor(v: FiltroDerechaNumor | null | undefined) {
    this.filtro.set({ ...FILTRO_DERECHA_NUMOR_INICIAL, ...(v ?? {}) });
  }
  /** Sin orden cuando la tabla ya se ordena desde los encabezados. */
  @Input() conOrden = true;
  /** Sin "Limpiar" cuando la pantalla ya tiene su propio botón para borrar filtros. */
  @Input() conLimpiar = true;
  /** Sin escala cuando la pantalla ya filtra por categoría (oficial / subalterno). */
  @Input() conEscala = true;
  /** Sin grado ni escalafón cuando la pantalla los muestra en su propia fila de filtros. */
  @Input() conGradoEscalafon = true;
  @Output() valorChange = new EventEmitter<FiltroDerechaNumor>();

  readonly filtro = signal<FiltroDerechaNumor>({ ...FILTRO_DERECHA_NUMOR_INICIAL });
  readonly grados = signal<GradoItem[]>([]);
  readonly escalafones = signal<OpcionSelect[]>([]);

  readonly escalas = Object.entries(NOMBRES_ESCALA).map(([value, label]) => ({
    value: value as EscalaDerecha,
    label,
  }));

  readonly opcionesOrden: { value: OrdenarPorDerechaNumor; label: string }[] = [
    { value: 'derecha', label: 'Ordenar por derecha' },
    { value: 'numor', label: 'Ordenar por numor' },
    { value: 'apellido', label: 'Ordenar por apellido' },
  ];

  readonly hayFiltro = computed(() => hayFiltroDerechaNumor(this.filtro()));

  ngOnInit(): void {
    if (!this.conGradoEscalafon) return;
    this.personal.getGrados().subscribe({ next: (g) => this.grados.set(g) });
    this.personal.getEscalafones().subscribe({ next: (e) => this.escalafones.set(e) });
  }

  alternarDireccion(): void {
    const actual: DireccionOrden = this.filtro().direccion ?? 'ASC';
    this.actualizar({ direccion: actual === 'ASC' ? 'DESC' : 'ASC' });
  }

  limpiarTodo(): void {
    const { ordenarPor, direccion } = this.filtro();
    this.filtro.set({ ...FILTRO_DERECHA_NUMOR_INICIAL, ordenarPor, direccion });
    this.valorChange.emit(this.filtro());
  }

  actualizar(cambio: Partial<FiltroDerechaNumor>): void {
    this.filtro.update((f) => ({ ...f, ...cambio }));
    this.valorChange.emit(this.filtro());
  }
}
