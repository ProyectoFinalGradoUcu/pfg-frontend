import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { PersonalService } from '../../../../core/services/personal.service';
import { FamiliarItem, PersonaDetalle } from '../../../../core/models/personal.models';

const GENERO_LABELS: Record<string, string> = { M: 'Masculino', F: 'Femenino', O: 'Otro' };

@Component({
  selector: 'app-familiar-detalle-modal',
  standalone: false,
  templateUrl: './familiar-detalle-modal.html',
  styleUrl: './familiar-detalle-modal.scss',
})
export class FamiliarDetalleModal implements OnInit {
  private readonly svc = inject(PersonalService);

  @Input({ required: true }) familiar!: FamiliarItem;
  @Output() cerrado = new EventEmitter<void>();

  readonly detalle = signal<PersonaDetalle | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getById(this.familiar.id).subscribe({
      next: d => { this.detalle.set(d); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar la información de este familiar. Intentá de nuevo.');
      },
    });
  }

  cerrar(): void {
    this.cerrado.emit();
  }

  initials(p: PersonaDetalle): string {
    return `${p.primer_nombre[0]}${p.primer_apellido[0]}`.toUpperCase();
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-UY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'UTC',
    });
  }

  formatGenero(g: string | null): string {
    if (!g) return '—';
    return GENERO_LABELS[g] ?? g;
  }
}
