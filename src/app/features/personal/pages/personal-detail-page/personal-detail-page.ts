import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  CursoPersona, FamiliarItem, GradoItem, HistorialMilitar,
  MisionPersona, OpcionSelect, PatchPersonaPayload, PersonaDetalle,
} from '../../../../core/models/personal.models';
import { PersonalService } from '../../../../core/services/personal.service';
import { ToastService } from '../../../../core/services/toast.service';

export type TabKey = 'personal' | 'familiar' | 'historial' | 'cursos' | 'misiones' | 'documentacion';

interface TabDef { key: TabKey; label: string }

@Component({
  selector: 'app-personal-detail-page',
  standalone: false,
  templateUrl: './personal-detail-page.html',
  styleUrl: './personal-detail-page.scss',
})
export class PersonalDetailPage implements OnInit, OnDestroy {
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly svc      = inject(PersonalService);
  private readonly toast    = inject(ToastService);
  private readonly fb       = inject(FormBuilder);

  private personaId!: number;

  // ─── Page state ───────────────────────────────────────────────────────────────
  readonly persona        = signal<PersonaDetalle | null>(null);
  readonly loadingPersona = signal(true);

  // ─── Tabs ─────────────────────────────────────────────────────────────────────
  readonly activeTab   = signal<TabKey>('personal');
  private readonly loadedTabs = new Set<TabKey>(['personal']);

  readonly visibleTabs = computed<TabDef[]>(() => {
    const p = this.persona();
    if (!p) return [];
    return [
      { key: 'personal',       label: 'Datos Personales'     },
      ...(p.es_civil
        ? [{ key: 'familiar' as TabKey, label: 'Información Familiar' }]
        : [{ key: 'historial' as TabKey, label: 'Historial Militar'   }]),
      { key: 'cursos',         label: 'Cursos'               },
      { key: 'misiones',       label: 'Misiones'             },
      { key: 'documentacion',  label: 'Documentación'        },
    ];
  });

  // ─── Tab data ─────────────────────────────────────────────────────────────────
  readonly familiares       = signal<FamiliarItem[]>([]);
  readonly loadingFamiliar  = signal(false);
  readonly historial        = signal<HistorialMilitar | null>(null);
  readonly loadingHistorial = signal(false);
  readonly sortedRangos     = computed(() => {
    const rangos = this.historial()?.historial_rangos ?? [];
    return [...rangos].sort((a, b) =>
      new Date(b.fecha_ascenso).getTime() - new Date(a.fecha_ascenso).getTime()
    );
  });
  readonly cursos           = signal<CursoPersona[]>([]);
  readonly loadingCursos    = signal(false);
  readonly misiones         = signal<MisionPersona[]>([]);
  readonly loadingMisiones  = signal(false);

  // ─── Edit drawer ──────────────────────────────────────────────────────────────
  readonly editMode    = signal(false);
  readonly editLoading = signal(false);

  readonly editGrados     = signal<GradoItem[]>([]);
  readonly editUnidades   = signal<OpcionSelect[]>([]);
  readonly editSituaciones= signal<OpcionSelect[]>([]);
  readonly editRegimenes  = signal<OpcionSelect[]>([]);
  readonly editProgramas  = signal<OpcionSelect[]>([]);
  readonly editEscalafones= signal<OpcionSelect[]>([]);
  readonly editCompanias  = signal<OpcionSelect[]>([]);
  private catalogsLoaded  = false;

  readonly generoOpciones = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino'  },
    { value: 'O', label: 'Otro'      },
  ];
  readonly estadoCivilOpciones = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre'];

  readonly editForm: FormGroup = this.fb.group({
    fecha_nacimiento:      [''],
    genero:                [''],
    estado_civil:          [''],
    lugar_nacimiento:      [''],
    etnia:                 [''],
    codigo_postal:         [''],
    seccional:             [''],
    email:                 ['', Validators.email],
    telefono:              [''],
    direccion:             [''],
    escalafon_id:          [null],
    grado_id:              [{ value: null, disabled: true }],
    unidad_id:             [null],
    situacion_id:          [null],
    regimen_id:            [null],
    programa_id:           [null],
    compania_id:           [null],
    prima_tecnica:         [''],
    tiene_mando:           [false],
    observaciones_laborales: [''],
  });

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    if (!raw || isNaN(Number(raw))) {
      this.router.navigate(['/personal']);
      return;
    }
    this.personaId = Number(raw);
    this.loadPersona();
    this.setupEscalafonCascade();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPersona(): void {
    this.loadingPersona.set(true);
    this.svc.getById(this.personaId).subscribe({
      next: p => { this.persona.set(p); this.loadingPersona.set(false); },
      error: (err: HttpErrorResponse) => {
        this.loadingPersona.set(false);
        if (err.status === 404) {
          this.toast.error('Personal no encontrado');
          this.router.navigate(['/personal']);
        } else {
          this.toast.error('Error al cargar el perfil');
        }
      },
    });
  }

  private setupEscalafonCascade(): void {
    this.editForm.get('escalafon_id')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id: number | null) => {
        const gradoCtrl = this.editForm.get('grado_id')!;
        gradoCtrl.reset(null);
        this.editGrados.set([]);
        if (id) {
          gradoCtrl.enable();
          this.svc.getGrados(Number(id)).subscribe({
            next: d => this.editGrados.set(d),
            error: () => gradoCtrl.disable(),
          });
        } else {
          gradoCtrl.disable();
        }
      });
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────────

  switchTab(key: TabKey): void {
    this.activeTab.set(key);
    if (this.loadedTabs.has(key)) return;
    this.loadedTabs.add(key);
    switch (key) {
      case 'familiar':
        this.loadingFamiliar.set(true);
        this.svc.getFamiliares(this.personaId).subscribe({
          next: d => { this.familiares.set(d); this.loadingFamiliar.set(false); },
          error: () => this.loadingFamiliar.set(false),
        });
        break;
      case 'historial':
        this.loadingHistorial.set(true);
        this.svc.getHistorialMilitar(this.personaId).subscribe({
          next: d => { this.historial.set(d); this.loadingHistorial.set(false); },
          error: () => this.loadingHistorial.set(false),
        });
        break;
      case 'cursos':
        this.loadingCursos.set(true);
        this.svc.getCursos(this.personaId).subscribe({
          next: d => { this.cursos.set(d); this.loadingCursos.set(false); },
          error: () => this.loadingCursos.set(false),
        });
        break;
      case 'misiones':
        this.loadingMisiones.set(true);
        this.svc.getMisiones(this.personaId).subscribe({
          next: d => { this.misiones.set(d); this.loadingMisiones.set(false); },
          error: () => this.loadingMisiones.set(false),
        });
        break;
    }
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────────

  openEdit(): void {
    const p = this.persona()!;
    const rl = p.relacion_laboral;

    // Patch sin emitir eventos para no disparar la cascada de escalafon→grado
    this.editForm.patchValue({
      fecha_nacimiento:      p.fecha_nacimiento  ? p.fecha_nacimiento.split('T')[0] : '',
      genero:                p.genero            ?? '',
      estado_civil:          p.estado_civil      ?? '',
      lugar_nacimiento:      p.lugar_nacimiento  ?? '',
      etnia:                 p.etnia             ?? '',
      codigo_postal:         p.codigo_postal     ?? '',
      seccional:             p.seccional         ?? '',
      email:                 p.email             ?? '',
      telefono:              p.telefono          ?? '',
      direccion:             p.direccion         ?? '',
      escalafon_id:          rl?.escalafon?.id   ?? null,
      grado_id:              rl?.grado?.id       ?? null,
      unidad_id:             rl?.unidad?.id      ?? null,
      situacion_id:          rl?.situacion?.id   ?? null,
      regimen_id:            rl?.regimen?.id     ?? null,
      programa_id:           rl?.programa?.id    ?? null,
      compania_id:           rl?.compania?.id    ?? null,
      prima_tecnica:         rl?.prima_tecnica   ?? '',
      tiene_mando:           rl?.tiene_mando     ?? false,
      observaciones_laborales: rl?.observaciones ?? '',
    }, { emitEvent: false });

    if (rl?.escalafon?.id) {
      this.editForm.get('grado_id')!.enable({ emitEvent: false });
    }

    if (!this.catalogsLoaded) {
      this.catalogsLoaded = true;
      this.svc.getUnidades().subscribe({ next: d => this.editUnidades.set(d) });
      this.svc.getSituaciones().subscribe({ next: d => this.editSituaciones.set(d) });
      this.svc.getRegimenes().subscribe({ next: d => this.editRegimenes.set(d) });
      this.svc.getProgramas().subscribe({ next: d => this.editProgramas.set(d) });
      this.svc.getEscalafones().subscribe({ next: d => this.editEscalafones.set(d) });
      this.svc.getCompanias().subscribe({ next: d => this.editCompanias.set(d) });
      if (rl?.escalafon?.id) {
        this.svc.getGrados(rl.escalafon.id).subscribe({ next: d => this.editGrados.set(d) });
      }
    }

    this.activeTab.set('personal');
    this.editMode.set(true);
  }

  closeEdit(): void {
    this.editMode.set(false);
  }

  saveEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const raw = this.editForm.getRawValue();
    const payload: PatchPersonaPayload = {
      ...(raw.fecha_nacimiento      && { fecha_nacimiento:      raw.fecha_nacimiento }),
      ...(raw.genero                && { genero:                raw.genero }),
      ...(raw.estado_civil          && { estado_civil:          raw.estado_civil }),
      ...(raw.lugar_nacimiento      && { lugar_nacimiento:      raw.lugar_nacimiento }),
      etnia:                           raw.etnia       || null,
      codigo_postal:                   raw.codigo_postal || null,
      seccional:                       raw.seccional   || null,
      ...(raw.email                 && { email:                 raw.email }),
      ...(raw.telefono              && { telefono:              raw.telefono }),
      ...(raw.direccion             && { direccion:             raw.direccion }),
      ...(raw.escalafon_id          && { escalafon_id:          Number(raw.escalafon_id) }),
      ...(raw.grado_id              && { grado_id:              Number(raw.grado_id) }),
      ...(raw.unidad_id             && { unidad_id:             Number(raw.unidad_id) }),
      ...(raw.situacion_id          && { situacion_id:          Number(raw.situacion_id) }),
      ...(raw.regimen_id            && { regimen_id:            Number(raw.regimen_id) }),
      ...(raw.programa_id           && { programa_id:           Number(raw.programa_id) }),
      compania_id:                     raw.compania_id ? Number(raw.compania_id) : null,
      prima_tecnica:                   raw.prima_tecnica || null,
      tiene_mando:                     raw.tiene_mando,
      observaciones_laborales:         raw.observaciones_laborales || null,
    };

    this.editLoading.set(true);
    this.svc.update(this.personaId, payload).subscribe({
      next: updated => {
        this.persona.set(updated);
        this.editLoading.set(false);
        this.editMode.set(false);
        this.toast.success('Perfil actualizado correctamente');
      },
      error: (err: HttpErrorResponse) => {
        this.editLoading.set(false);
        const msg = err.status === 400 && err.error?.message
          ? err.error.message
          : 'Error al guardar los cambios. Intentá de nuevo.';
        this.toast.error(msg);
      },
    });
  }

  hasEditError(name: string): boolean {
    const ctrl = this.editForm.get(name);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  initials(p: PersonaDetalle): string {
    return `${p.primer_nombre[0]}${p.primer_apellido[0]}`.toUpperCase();
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-UY', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  formatGenero(g: string | null): string {
    if (!g) return '—';
    return ({ M: 'Masculino', F: 'Femenino', O: 'Otro' } as Record<string, string>)[g] ?? g;
  }

  volver(): void {
    this.router.navigate(['/personal']);
  }
}
