import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PersonalDetailPage } from './personal-detail-page';
import { PersonalService } from '../../../../core/services/personal.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FamiliarItem, PersonaDetalle, PersonaListItem, RelacionLaboral } from '../../../../core/models/personal.models';

function makePersonaDetalle(overrides: Partial<PersonaDetalle> = {}): PersonaDetalle {
  return {
    id: 31,
    cedula: '12345678',
    nombre_completo: 'Sofía Guerrico',
    primer_nombre: 'Sofía',
    segundo_nombre: null,
    primer_apellido: 'Guerrico',
    segundo_apellido: null,
    fecha_nacimiento: null,
    email: null,
    telefono: null,
    direccion: null,
    genero: null,
    estado_civil: null,
    lugar_nacimiento: null,
    etnia: null,
    codigo_postal: null,
    seccional: null,
    credencial_civica: null,
    nivel_idoneidad: null,
    es_civil: true,
    relacion_laboral: null,
    legajo_militar: {
      nivel_educativo: null,
      nivel_educativo_label: null,
      fecha_ingreso_eta: null,
      fecha_egreso_eta: null,
      numero_orden_egreso_eta: null,
      egresado_eta: false,
      mutaciones: null,
      es_mutado: false,
    },
    ...overrides,
  };
}

function makeRelacion(overrides: Partial<RelacionLaboral> = {}): RelacionLaboral {
  return {
    id: 7,
    estado: 'activo',
    derecha: null,
    numor: null,
    tipo_funcionario: 'subalterno',
    fecha_inicio: '2020-03-01',
    fecha_ultimo_ascenso: null,
    fecha_ascenso_oficial: null,
    mutaciones: null,
    tiene_mando: false,
    prima_tecnica: null,
    observaciones: null,
    codigos_legajo: null,
    grado: { id: 4, codigo: 'CBO1', denominacion: 'Cabo de 1ra' },
    unidad: { id: 3, codigo: 'CAO', denominacion: 'C.A.O.' },
    situacion: { id: 1, codigo: 'ACT', denominacion: 'Actividad' },
    regimen: { id: 1, denominacion: 'General' },
    programa: { id: 1, denominacion: 'Programa 1' },
    escalafon: { id: 2, denominacion: 'Personal Subalterno' },
    sub_unidad: { id: 12, denominacion: 'B.A.I.' },
    ...overrides,
  };
}

function makeFamiliarItem(overrides: Partial<FamiliarItem> = {}): FamiliarItem {
  return { id: 16, cedula: '60000016', nombre_completo: 'Laura Acosta', tipo_relacion: 'Madre', grado: null, unidad: null, ...overrides };
}

function makePersonaListItem(overrides: Partial<PersonaListItem> = {}): PersonaListItem {
  return { id: '33', nombre: 'Nuevo Subalterno', cedula: '88888801', rango: 'Soldado', destino: 'Cuartel General', estado: 'Activo', relacion_estado: 'activo', ...overrides };
}

describe('PersonalDetailPage', () => {
  let component: PersonalDetailPage;
  let fixture: ComponentFixture<PersonalDetailPage>;
  let svc: {
    getById: ReturnType<typeof vi.fn>;
    getFamiliares: ReturnType<typeof vi.fn>;
    agregarFamiliar: ReturnType<typeof vi.fn>;
    quitarFamiliar: ReturnType<typeof vi.fn>;
    findPaginado: ReturnType<typeof vi.fn>;
    getGrados: ReturnType<typeof vi.fn>;
    getHistorialMilitar: ReturnType<typeof vi.fn>;
    getCursos: ReturnType<typeof vi.fn>;
    getDestinos: ReturnType<typeof vi.fn>;
    getMisiones: ReturnType<typeof vi.fn>;
    getSituaciones: ReturnType<typeof vi.fn>;
    getRegimenes: ReturnType<typeof vi.fn>;
    getProgramas: ReturnType<typeof vi.fn>;
    getEscalafones: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    svc = {
      getById: vi.fn().mockReturnValue(of(makePersonaDetalle())),
      getFamiliares: vi.fn().mockReturnValue(of([makeFamiliarItem()])),
      agregarFamiliar: vi.fn(),
      quitarFamiliar: vi.fn(),
      findPaginado: vi.fn().mockReturnValue(of({ items: [makePersonaListItem()], total: 1, page: 1, pageSize: 8 })),
      getGrados: vi.fn().mockReturnValue(of([])),
      getHistorialMilitar: vi.fn().mockReturnValue(of({ historial_rangos: [] })),
      getCursos: vi.fn().mockReturnValue(of([])),
      getDestinos: vi.fn().mockReturnValue(of([])),
      getMisiones: vi.fn().mockReturnValue(of([])),
      getSituaciones: vi.fn().mockReturnValue(of([])),
      getRegimenes: vi.fn().mockReturnValue(of([])),
      getProgramas: vi.fn().mockReturnValue(of([])),
      getEscalafones: vi.fn().mockReturnValue(of([])),
      update: vi.fn().mockReturnValue(of(makePersonaDetalle())),
    };
    toastService = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [PersonalDetailPage],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: PersonalService, useValue: svc },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '31' } } } },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('visibleTabs', () => {
    it('incluye "familiar" para un funcionario civil', () => {
      const keys = component.visibleTabs().map(t => t.key);
      expect(keys).toContain('familiar');
      expect(keys).not.toContain('historial');
    });

    it('incluye "familiar" también para un funcionario militar (antes solo aparecía para civiles)', () => {
      svc.getById.mockReturnValue(of(makePersonaDetalle({ es_civil: false })));
      fixture = TestBed.createComponent(PersonalDetailPage);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const keys = component.visibleTabs().map(t => t.key);
      expect(keys).toContain('familiar');
      expect(keys).toContain('historial');
    });
  });

  describe('documentos', () => {
    it('la pestaña se llama "Documentos"', () => {
      const tab = component.visibleTabs().find((t) => t.key === 'documentos');
      expect(tab?.label).toBe('Documentos');
      expect(component.visibleTabs().some((t) => (t.key as string) === 'documentacion')).toBe(false);
    });

    it('al abrir la pestaña monta app-documentos-personal en vez del placeholder', () => {
      component.switchTab('documentos');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-documentos-personal')).not.toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Sección de documentos en desarrollo.');
    });

    it('puede editar documentos con personas.editar o su variante .unidad', () => {
      const spy = vi.spyOn(TestBed.inject(AuthService), 'puedeConAlcance').mockReturnValue(true);
      expect(component.puedeEditarDocumentos()).toBe(true);
      expect(spy).toHaveBeenCalledWith('personas.editar');
    });
  });

  describe('familiares — carga, error y reintento', () => {
    it('carga los familiares al entrar a la pestaña', () => {
      component.switchTab('familiar');
      expect(svc.getFamiliares).toHaveBeenCalledWith(31);
      expect(component.familiares()).toEqual([makeFamiliarItem()]);
      expect(component.familiarError()).toBeNull();
    });

    it('ante un error muestra un mensaje y no la lista', () => {
      svc.getFamiliares.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.switchTab('familiar');
      expect(component.familiarError()).toBe('No se pudo cargar la información familiar. Intentá de nuevo.');
      expect(component.familiares()).toEqual([]);
    });

    it('reintentar vuelve a pedir los familiares y limpia el error si esta vez funciona', () => {
      svc.getFamiliares.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.switchTab('familiar');
      expect(component.familiarError()).not.toBeNull();

      svc.getFamiliares.mockReturnValue(of([makeFamiliarItem()]));
      component.retryFamiliares();
      expect(component.familiarError()).toBeNull();
      expect(component.familiares()).toEqual([makeFamiliarItem()]);
    });
  });

  describe('agregar familiar (modo edición)', () => {
    it('el buscador descarta a la propia persona y a quienes ya son familiares', () => {
      vi.useFakeTimers();
      component.switchTab('familiar'); // carga [makeFamiliarItem()] -> cedula 60000016
      svc.findPaginado.mockReturnValue(of({
        items: [
          makePersonaListItem({ id: '31', cedula: '12345678' }),   // es la propia persona
          makePersonaListItem({ id: '16', cedula: '60000016' }),   // ya es familiar
          makePersonaListItem({ id: '33', cedula: '88888801' }),   // candidato válido
        ],
        total: 3, page: 1, pageSize: 8,
      }));

      component.onFamiliarAddSearch({ target: { value: 'algo' } } as unknown as Event);
      vi.advanceTimersByTime(400);

      expect(component.familiarAddResults().map(p => p.cedula)).toEqual(['88888801']);
      vi.useRealTimers();
    });

    it('elegir un candidato lo deja pendiente de confirmar y limpia la búsqueda', () => {
      component.elegirFamiliarAAgregar(makePersonaListItem());
      expect(component.familiarAddElegido()).toEqual(makePersonaListItem());
      expect(component.familiarAddSearch()).toBe('');
      expect(component.familiarAddResults()).toEqual([]);
    });

    it('cancelar deja todo como al principio', () => {
      component.elegirFamiliarAAgregar(makePersonaListItem());
      component.familiarAddTipoRelacion.set('Cónyuge');
      component.cancelarAgregarFamiliar();
      expect(component.familiarAddElegido()).toBeNull();
      expect(component.familiarAddTipoRelacion()).toBe('');
    });

    it('confirmar agrega el familiar a la lista, resetea el panel y avisa', () => {
      const agregado = makeFamiliarItem({ id: 33, cedula: '88888801', nombre_completo: 'Nuevo Subalterno', tipo_relacion: 'Cónyuge' });
      svc.agregarFamiliar.mockReturnValue(of(agregado));
      component.switchTab('familiar'); // arranca con [Laura]
      component.elegirFamiliarAAgregar(makePersonaListItem());
      component.familiarAddTipoRelacion.set('Cónyuge');

      component.confirmarAgregarFamiliar();

      expect(svc.agregarFamiliar).toHaveBeenCalledWith(31, { cedula: '88888801', tipo_relacion: 'Cónyuge' });
      expect(component.familiares()).toEqual([makeFamiliarItem(), agregado]);
      expect(component.familiarAddElegido()).toBeNull();
      expect(component.guardandoFamiliar()).toBe(false);
      expect(toastService.success).toHaveBeenCalledWith('Familiar agregado correctamente');
    });

    it('no manda tipo_relacion si quedó vacío', () => {
      svc.agregarFamiliar.mockReturnValue(of(makeFamiliarItem()));
      component.elegirFamiliarAAgregar(makePersonaListItem());
      component.confirmarAgregarFamiliar();
      expect(svc.agregarFamiliar).toHaveBeenCalledWith(31, { cedula: '88888801' });
    });

    it('ante un 409 del backend muestra el mensaje del backend', () => {
      svc.agregarFamiliar.mockReturnValue(throwError(() => new HttpErrorResponse({
        status: 409,
        error: { message: 'Nuevo Subalterno ya está vinculado como familiar' },
      })));
      component.elegirFamiliarAAgregar(makePersonaListItem());
      component.confirmarAgregarFamiliar();
      expect(toastService.error).toHaveBeenCalledWith('Nuevo Subalterno ya está vinculado como familiar');
      expect(component.guardandoFamiliar()).toBe(false);
    });

    it('ante un error sin mensaje del backend muestra el mensaje genérico', () => {
      svc.agregarFamiliar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.elegirFamiliarAAgregar(makePersonaListItem());
      component.confirmarAgregarFamiliar();
      expect(toastService.error).toHaveBeenCalledWith('No se pudo agregar el familiar. Intentá de nuevo.');
    });

    it('cerrar o guardar la edición resetea el panel de agregar familiar', () => {
      component.elegirFamiliarAAgregar(makePersonaListItem());
      component.closeEdit();
      expect(component.familiarAddElegido()).toBeNull();
    });
  });

  describe('quitar familiar', () => {
    let confirmSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      component.switchTab('familiar'); // arranca con [Laura]
    });

    afterEach(() => confirmSpy?.mockRestore());

    it('si el operador cancela la confirmación, no llama al backend', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      component.quitarFamiliar(makeFamiliarItem());
      expect(svc.quitarFamiliar).not.toHaveBeenCalled();
      expect(component.familiares()).toEqual([makeFamiliarItem()]);
    });

    it('si confirma, lo saca de la lista y avisa', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      svc.quitarFamiliar.mockReturnValue(of(undefined));
      component.quitarFamiliar(makeFamiliarItem());
      expect(svc.quitarFamiliar).toHaveBeenCalledWith(31, 16);
      expect(component.familiares()).toEqual([]);
      expect(toastService.success).toHaveBeenCalledWith('Familiar quitado correctamente');
    });

    it('si el backend falla, deja la lista como estaba y avisa del error', () => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      svc.quitarFamiliar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.quitarFamiliar(makeFamiliarItem());
      expect(component.familiares()).toEqual([makeFamiliarItem()]);
      expect(toastService.error).toHaveBeenCalledWith('No se pudo quitar el familiar. Intentá de nuevo.');
    });
  });

  // `GET /personas/:id` selecciona la relación con `fecha_fin: null`, así que para un
  // retirado devuelve `relacion_laboral: null`. El factory de arriba ya usa ese caso.
  describe('funcionario sin relación laboral abierta (retirado)', () => {
    it('muestra un estado explícito en vez de un bloque vacío', () => {
      const texto: string = fixture.nativeElement.textContent ?? '';
      expect(texto).toContain('Sin relación laboral vigente');
    });

    it('abrir el drawer de edición no rompe', () => {
      expect(() => {
        component.openEdit();
        fixture.detectChanges();
      }).not.toThrow();
      expect(component.editMode()).toBe(true);
    });

    it('no ofrece los campos laborales en el drawer', () => {
      component.openEdit();
      fixture.detectChanges();
      const texto: string = fixture.nativeElement.textContent ?? '';
      expect(texto).not.toContain('El comando se cambia registrando un destino');
    });

    it('tieneRelacionLaboral es false', () => {
      expect(component.tieneRelacionLaboral()).toBe(false);
    });
  });

  describe('base y registro de destino', () => {
    // Recrea la página con un funcionario en actividad y los permisos pedidos.
    function conMilitar(relacion: Partial<RelacionLaboral> = {}, permisos: string[] = ['destinos.gestionar']): void {
      vi.spyOn(TestBed.inject(AuthService), 'hasPermiso').mockImplementation((p: string) => permisos.includes(p));
      svc.getById.mockReturnValue(of(makePersonaDetalle({ es_civil: false, relacion_laboral: makeRelacion(relacion) })));
      svc.getById.mockClear();
      fixture = TestBed.createComponent(PersonalDetailPage);
      component = fixture.componentInstance;
      fixture.detectChanges();
    }

    const botonRegistrar = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector('.pd__registrar-destino');

    it('muestra la base con su comando', () => {
      conMilitar();
      expect(component.baseActual()).toBe('B.A.I. (C.A.O.)');
      expect(fixture.nativeElement.textContent).toContain('B.A.I. (C.A.O.)');
    });

    it('si la relación no tiene base muestra solo el comando', () => {
      conMilitar({ sub_unidad: null });
      expect(component.baseActual()).toBe('Sin base (C.A.O.)');
    });

    it('sin relación laboral no hay base', () => {
      expect(component.baseActual()).toBe('—');
    });

    it('con destinos.gestionar y relación activa ofrece registrar un destino', () => {
      conMilitar();
      expect(botonRegistrar()).not.toBeNull();
    });

    it('sin el permiso no aparece el botón', () => {
      conMilitar({}, []);
      expect(botonRegistrar()).toBeNull();
    });

    it('con la relación no activa no aparece el botón', () => {
      conMilitar({ estado: 'suspendido' });
      expect(botonRegistrar()).toBeNull();
    });

    it('el botón abre el modal de destino con la persona ya elegida', () => {
      conMilitar();
      botonRegistrar()!.click();
      fixture.detectChanges();

      const modal = fixture.nativeElement.querySelector('app-destino-form-modal');
      expect(component.registrandoDestino()).toBe(true);
      expect(modal).not.toBeNull();
      expect(modal.persona).toEqual({ id: '31', nombre: 'Sofía Guerrico', cedula: '12345678' });
    });

    it('cerrar el modal no recarga nada', () => {
      conMilitar();
      component.abrirRegistrarDestino();
      component.cerrarRegistrarDestino();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-destino-form-modal')).toBeNull();
      expect(svc.getById).toHaveBeenCalledTimes(1);
    });

    it('al registrar el destino cierra el modal, avisa y recarga la persona', () => {
      conMilitar();
      component.abrirRegistrarDestino();
      svc.getById.mockReturnValue(
        of(makePersonaDetalle({ es_civil: false, relacion_laboral: makeRelacion({ sub_unidad: { id: 13, denominacion: 'B.A.II' } }) })),
      );

      component.onDestinoRegistrado();

      expect(component.registrandoDestino()).toBe(false);
      expect(toastService.success).toHaveBeenCalledWith('Destino registrado');
      expect(svc.getById).toHaveBeenCalledTimes(2);
      expect(component.baseActual()).toBe('B.A.II (C.A.O.)');
    });

    it('si la pestaña Destinos está abierta la vuelve a pedir enseguida', () => {
      conMilitar();
      component.switchTab('destinos');
      expect(svc.getDestinos).toHaveBeenCalledTimes(1);

      component.onDestinoRegistrado();

      expect(svc.getDestinos).toHaveBeenCalledTimes(2);
    });

    it('si la pestaña Destinos ya se había cargado, la pide de nuevo al volver a abrirla', () => {
      conMilitar();
      component.switchTab('destinos');
      component.switchTab('personal');

      component.onDestinoRegistrado();
      expect(svc.getDestinos).toHaveBeenCalledTimes(1);

      component.switchTab('destinos');
      expect(svc.getDestinos).toHaveBeenCalledTimes(2);
    });

    it('guardar la edición no manda ni base ni comando', () => {
      conMilitar();
      component.openEdit();
      component.saveEdit();

      expect(svc.update).toHaveBeenCalled();
      const payload = svc.update.mock.calls[0][1];
      expect('sub_unidad_id' in payload).toBe(false);
      expect('unidad_id' in payload).toBe(false);
    });

    it('el drawer de edición ya no tiene selector de base', () => {
      conMilitar();
      component.openEdit();
      fixture.detectChanges();

      expect(component.editForm.get('sub_unidad_id')).toBeNull();
      expect(fixture.nativeElement.querySelector('[formControlName="sub_unidad_id"]')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('La base no se edita acá');
    });
  });
});
