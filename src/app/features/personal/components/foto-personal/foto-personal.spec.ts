import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { FotoPersonal } from './foto-personal';
import { FotoPersonalService } from '../../../../core/services/foto-personal.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { ToastService } from '../../../../core/services/toast.service';

describe('FotoPersonal', () => {
  let fixture: ComponentFixture<FotoPersonal>;
  let component: FotoPersonal;
  let svc: { url: ReturnType<typeof vi.fn>; cargar: ReturnType<typeof vi.fn>; quitar: ReturnType<typeof vi.fn> };
  let confirm: { confirmar: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  async function montar({ fotoId = null as string | null, puedeEditar = true } = {}): Promise<void> {
    svc = {
      url: vi.fn((personaId: number, id: string) => `/api/personas/${personaId}/foto?v=${id}`),
      cargar: vi.fn(),
      quitar: vi.fn(),
    };
    confirm = { confirmar: vi.fn().mockResolvedValue(true) };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [FotoPersonal],
      providers: [
        { provide: FotoPersonalService, useValue: svc },
        { provide: ConfirmModalService, useValue: confirm },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FotoPersonal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('personaId', 31);
    fixture.componentRef.setInput('fotoId', fotoId);
    fixture.componentRef.setInput('iniciales', 'JP');
    fixture.componentRef.setInput('puedeEditar', puedeEditar);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  const el = () => fixture.nativeElement as HTMLElement;
  const avatar = () => el().querySelector('.foto') as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === texto) as
      | HTMLButtonElement
      | undefined;

  it('sin foto muestra las iniciales', async () => {
    await montar();

    expect(avatar().querySelector('img')).toBeNull();
    expect(avatar().textContent).toContain('JP');
  });

  it('con foto la pide con la URL versionada', async () => {
    await montar({ fotoId: '90' });

    expect(avatar().querySelector('img')?.getAttribute('src')).toBe('/api/personas/31/foto?v=90');
  });

  it('si la foto no carga, vuelve a las iniciales', async () => {
    await montar({ fotoId: '90' });

    avatar().querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(avatar().querySelector('img')).toBeNull();
    expect(avatar().textContent).toContain('JP');
  });

  it('una foto nueva vuelve a intentar cargarla aunque la anterior haya fallado', async () => {
    await montar({ fotoId: '90' });
    avatar().querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    fixture.componentRef.setInput('fotoId', '91');
    fixture.detectChanges();

    expect(avatar().querySelector('img')?.getAttribute('src')).toBe('/api/personas/31/foto?v=91');
  });

  it('sin permiso de edición ve la foto pero no puede cambiarla', async () => {
    await montar({ fotoId: '90', puedeEditar: false });

    expect(avatar().querySelector('img')).not.toBeNull();
    expect(el().querySelector('.foto__editar')).toBeNull();
  });

  it('Quitar foto solo aparece si tiene foto', async () => {
    await montar();
    component.abrir();
    fixture.detectChanges();

    expect(boton('Quitar foto')).toBeUndefined();
  });

  it('Guardar está deshabilitado hasta elegir una imagen', async () => {
    await montar({ fotoId: '90' });
    component.abrir();
    fixture.detectChanges();

    expect(boton('Guardar')?.disabled).toBe(true);
  });

  it('rechaza un archivo que no es JPG ni PNG sin subir nada', async () => {
    await montar();
    component.abrir();
    const archivo = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });

    await component.elegir({ target: { files: [archivo], value: 'cv.pdf' } } as unknown as Event);
    fixture.detectChanges();

    expect(el().querySelector('.modal__error')?.textContent).toContain('Solo se aceptan imágenes JPG o PNG');
    expect(component.vista()).toBeNull();
    expect(svc.cargar).not.toHaveBeenCalled();
  });

  it('cancelar cierra el modal sin subir nada', async () => {
    await montar();
    component.abrir();
    fixture.detectChanges();

    boton('Cancelar')!.click();
    fixture.detectChanges();

    expect(el().querySelector('.modal')).toBeNull();
    expect(svc.cargar).not.toHaveBeenCalled();
  });

  it('quitar pide confirmación, borra y avisa que no hay foto', async () => {
    await montar({ fotoId: '90' });
    svc.quitar.mockReturnValue(of(null));
    const cambiada = vi.fn();
    component.fotoCambiada.subscribe(cambiada);
    component.abrir();

    await component.quitar();

    expect(confirm.confirmar).toHaveBeenCalled();
    expect(svc.quitar).toHaveBeenCalledWith(31);
    expect(cambiada).toHaveBeenCalledWith(null);
    expect(component.abierto()).toBe(false);
  });

  it('si no confirma, no quita nada', async () => {
    await montar({ fotoId: '90' });
    confirm.confirmar.mockResolvedValue(false);

    await component.quitar();

    expect(svc.quitar).not.toHaveBeenCalled();
  });

  it('si falla quitar, muestra el error y conserva la foto', async () => {
    await montar({ fotoId: '90' });
    svc.quitar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const cambiada = vi.fn();
    component.fotoCambiada.subscribe(cambiada);
    component.abrir();

    await component.quitar();
    fixture.detectChanges();

    expect(cambiada).not.toHaveBeenCalled();
    expect(el().querySelector('.modal__error')?.textContent).toContain('No se pudo conectar con el servidor');
  });
});
