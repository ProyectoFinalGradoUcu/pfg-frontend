import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { FamiliarEntry, GradoItem, OpcionSelect, PersonaListItem } from '../../../../core/models/personal.models';
import { PersonalService } from '../../../../core/services/personal.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-nuevo-personal-page',
  standalone: false,
  templateUrl: './nuevo-personal-page.html',
  styleUrl: './nuevo-personal-page.scss',
})
export class NuevoPersonalPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly personalService = inject(PersonalService);
  private readonly toast = inject(ToastService);

  // ─── Estado general ──────────────────────────────────────────────────────────
  readonly loading = signal(false);

  // ─── Dropdowns catálogos ─────────────────────────────────────────────────────
  readonly regimenes   = signal<OpcionSelect[]>([]);
  readonly escalafones = signal<OpcionSelect[]>([]);
  readonly grados      = signal<GradoItem[]>([]);
  readonly unidades    = signal<OpcionSelect[]>([]);
  readonly programas   = signal<OpcionSelect[]>([]);
  readonly situaciones = signal<OpcionSelect[]>([]);
  readonly subUnidades = signal<OpcionSelect[]>([]);

  // ─── Familiares (civil) ───────────────────────────────────────────────────────
  readonly familiares       = signal<FamiliarEntry[]>([]);
  readonly familiaresError  = signal(false);

  // ─── Autocomplete búsqueda de familiar ───────────────────────────────────────
  readonly familiarSearch       = signal('');
  readonly familiarResults      = signal<PersonaListItem[]>([]);
  readonly familiarDropdownOpen = signal(false);

  // ─── Opciones estáticas ───────────────────────────────────────────────────────
  readonly generoOpciones = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' },
    { value: 'O', label: 'Otro' },
  ];
  readonly estadoCivilOpciones = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unión libre'];
  readonly tipoFuncionarioOpciones = [
    { value: 'oficial',    label: 'Oficial' },
    { value: 'subalterno', label: 'Subalterno' },
    { value: 'civil',      label: 'Civil' },
  ];
  readonly tipoRelacionOpciones = ['Cónyuge', 'Padre', 'Madre', 'Hijo/a', 'Hermano/a', 'Otro'];

  // ─── Formulario ───────────────────────────────────────────────────────────────
  readonly form: FormGroup = this.fb.group({
    cedula:           ['', [Validators.required, Validators.maxLength(12)]],
    primer_nombre:    ['', Validators.required],
    segundo_nombre:   [''],
    primer_apellido:  ['', Validators.required],
    segundo_apellido: [''],
    fecha_nacimiento: [''],
    genero:           [''],
    estado_civil:     [''],
    lugar_nacimiento: [''],
    email:            ['', Validators.email],
    telefono:         [''],
    direccion:        [''],
    es_civil:         [false],
    // Datos laborales — requeridos sólo cuando no es civil
    tipo_funcionario: ['', Validators.required],
    regimen_id:       [null, Validators.required],
    escalafon_id:     [null, Validators.required],
    grado_id:         [{ value: null, disabled: true }, Validators.required],
    unidad_id:        [null, Validators.required],
    programa_id:      [null, Validators.required],
    situacion_id:     [null, Validators.required],
    sub_unidad_id:    [null],
    fecha_inicio:     ['', Validators.required],
    // Siempre presente
    observaciones:    [''],
  });

  private readonly destroy$        = new Subject<void>();
  private readonly familiarSearch$ = new Subject<string>();

  ngOnInit(): void {
    this.loadDropdowns();
    this.setupEscalafonCascade();
    this.setupCivilToggle();
    this.setupFamiliarSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Setup ────────────────────────────────────────────────────────────────────

  private loadDropdowns(): void {
    this.personalService.getRegimenes().subscribe({ next: d => this.regimenes.set(d) });
    this.personalService.getEscalafones().subscribe({ next: d => this.escalafones.set(d) });
    this.personalService.getUnidades().subscribe({ next: d => this.unidades.set(d) });
    this.personalService.getProgramas().subscribe({ next: d => this.programas.set(d) });
    this.personalService.getSituaciones().subscribe({ next: d => this.situaciones.set(d) });
    this.personalService.getSubUnidades().subscribe({ next: d => this.subUnidades.set(d) });
  }

  private setupEscalafonCascade(): void {
    this.form.get('escalafon_id')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id: number | null) => {
        const gradoCtrl = this.form.get('grado_id')!;
        gradoCtrl.reset(null);
        this.grados.set([]);
        if (id && !this.form.get('es_civil')!.value) {
          gradoCtrl.enable();
          this.personalService.getGrados(Number(id)).subscribe({
            next: data => this.grados.set(data),
            error: () => gradoCtrl.disable(),
          });
        } else {
          gradoCtrl.disable();
        }
      });
  }

  private setupCivilToggle(): void {
    this.form.get('es_civil')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((esCivil: boolean) => {
        this.toggleCivilMode(esCivil);
        if (!esCivil) {
          // Al volver a no-civil, limpiar familiares
          this.familiares.set([]);
          this.familiaresError.set(false);
        }
      });
  }

  private setupFamiliarSearch(): void {
    this.familiarSearch$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(term => {
        if (!term || term.length < 2) {
          this.familiarResults.set([]);
          return;
        }
        this.personalService
          .findPaginado({ search: term, pageSize: 8 })
          .subscribe({ next: res => this.familiarResults.set(res.items) });
      });
  }

  private toggleCivilMode(esCivil: boolean): void {
    const laboralRequired = [
      'tipo_funcionario', 'regimen_id', 'escalafon_id',
      'unidad_id', 'programa_id', 'situacion_id', 'fecha_inicio',
    ];
    if (esCivil) {
      laboralRequired.forEach(f => {
        const ctrl = this.form.get(f)!;
        ctrl.clearValidators();
        ctrl.updateValueAndValidity({ emitEvent: false });
      });
      const gradoCtrl = this.form.get('grado_id')!;
      gradoCtrl.clearValidators();
      gradoCtrl.disable();
      gradoCtrl.updateValueAndValidity({ emitEvent: false });
    } else {
      laboralRequired.forEach(f => {
        const ctrl = this.form.get(f)!;
        ctrl.setValidators(Validators.required);
        ctrl.updateValueAndValidity({ emitEvent: false });
      });
      const gradoCtrl = this.form.get('grado_id')!;
      gradoCtrl.setValidators(Validators.required);
      gradoCtrl.disable();
      gradoCtrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  // ─── Gestión de familiares ────────────────────────────────────────────────────

  onFamiliarSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.familiarSearch.set(val);
    this.familiarDropdownOpen.set(true);
    this.familiarSearch$.next(val);
  }

  onFamiliarBlur(): void {
    setTimeout(() => this.familiarDropdownOpen.set(false), 200);
  }

  addFamiliar(persona: PersonaListItem): void {
    const yaAgregado = this.familiares().some(f => f.persona.cedula === persona.cedula);
    if (yaAgregado) return;
    this.familiares.update(list => [...list, { persona, tipo_relacion: '' }]);
    this.familiaresError.set(false);
    // Limpiar búsqueda para agregar otro
    this.familiarSearch.set('');
    this.familiarResults.set([]);
    this.familiarDropdownOpen.set(false);
  }

  removeFamiliar(index: number): void {
    this.familiares.update(list => list.filter((_, i) => i !== index));
  }

  updateTipoRelacion(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.familiares.update(list =>
      list.map((f, i) => i === index ? { ...f, tipo_relacion: value } : f)
    );
  }

  // ─── Helpers de formulario ────────────────────────────────────────────────────

  hasError(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  getError(name: string): string {
    const errors = this.form.get(name)?.errors;
    if (!errors) return '';
    if (errors['cedulaDuplicada']) return 'Ya existe un funcionario con esta cédula';
    if (errors['required'])        return 'Este campo es obligatorio';
    if (errors['email'])           return 'Ingresá un email válido';
    if (errors['maxlength'])       return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Valor inválido';
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────────

  cancelar(): void {
    this.router.navigate(['/personal']);
  }

  submit(): void {
    this.form.markAllAsTouched();
    const esCivil: boolean = this.form.get('es_civil')!.value;

    if (esCivil && this.familiares().length === 0) {
      this.familiaresError.set(true);
    }

    if (this.form.invalid || (esCivil && this.familiares().length === 0)) return;

    this.loading.set(true);
    const raw = this.form.getRawValue();

    const payload: Record<string, unknown> = {
      cedula:          raw.cedula,
      primer_nombre:   raw.primer_nombre,
      primer_apellido: raw.primer_apellido,
      es_civil:        esCivil,
      ...(raw.segundo_nombre   && { segundo_nombre:   raw.segundo_nombre }),
      ...(raw.segundo_apellido && { segundo_apellido: raw.segundo_apellido }),
      ...(raw.fecha_nacimiento && { fecha_nacimiento: raw.fecha_nacimiento }),
      ...(raw.genero           && { genero:           raw.genero }),
      ...(raw.estado_civil     && { estado_civil:     raw.estado_civil }),
      ...(raw.lugar_nacimiento && { lugar_nacimiento: raw.lugar_nacimiento }),
      ...(raw.email            && { email:            raw.email }),
      ...(raw.telefono         && { telefono:         raw.telefono }),
      ...(raw.direccion        && { direccion:        raw.direccion }),
      ...(raw.observaciones    && { observaciones:    raw.observaciones }),
    };

    if (esCivil) {
      payload['familiares'] = this.familiares().map(f => ({
        cedula: f.persona.cedula,
        ...(f.tipo_relacion && { tipo_relacion: f.tipo_relacion }),
      }));
    } else {
      payload['tipo_funcionario'] = raw.tipo_funcionario;
      payload['regimen_id']       = Number(raw.regimen_id);
      payload['escalafon_id']     = Number(raw.escalafon_id);
      payload['grado_id']         = Number(raw.grado_id);
      payload['unidad_id']        = Number(raw.unidad_id);
      payload['programa_id']      = Number(raw.programa_id);
      payload['situacion_id']     = Number(raw.situacion_id);
      payload['fecha_inicio']     = raw.fecha_inicio;
      if (raw.sub_unidad_id) payload['sub_unidad_id'] = Number(raw.sub_unidad_id);
    }

    this.personalService.crear(payload as never).subscribe({
      next: () => {
        this.toast.success('Personal creado exitosamente');
        this.router.navigate(['/personal']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.form.get('cedula')!.setErrors({ cedulaDuplicada: true });
          this.form.get('cedula')!.markAsTouched();
        } else if (err.status === 400) {
          this.toast.error('Error de validación. Revisá los datos ingresados.');
        } else {
          this.toast.error('Ocurrió un error inesperado. Intentá de nuevo.');
        }
      },
    });
  }
}
