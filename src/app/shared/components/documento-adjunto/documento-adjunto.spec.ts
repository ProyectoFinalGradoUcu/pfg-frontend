import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { vi } from 'vitest';

import { DocumentoAdjunto } from './documento-adjunto';

function pdf(nombre = 'orden.pdf'): File {
  return new File(['%PDF-1.4'], nombre, { type: 'application/pdf' });
}

describe('DocumentoAdjunto', () => {
  let fixture: ComponentFixture<DocumentoAdjunto>;
  let component: DocumentoAdjunto;
  let el: HTMLElement;

  async function montar(inputs: Partial<Record<keyof DocumentoAdjunto, unknown>> = {}): Promise<void> {
    await TestBed.configureTestingModule({ declarations: [DocumentoAdjunto] }).compileComponents();
    fixture = TestBed.createComponent(DocumentoAdjunto);
    component = fixture.componentInstance;
    for (const [clave, valor] of Object.entries(inputs)) {
      fixture.componentRef.setInput(clave, valor);
    }
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().includes(texto)) as
      | HTMLButtonElement
      | undefined;
  const accion = (titulo: string) =>
    (el.querySelector(`[title="${titulo}"]`) as HTMLElement | null) ?? undefined;

  function elegir(archivo: File): void {
    const input = el.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  const url = (u: string) => TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl(u);

  it('con documento muestra el nombre, Ver y el link de Descargar', async () => {
    await montar({
      nombre: 'orden.pdf',
      tamanio: '2048',
      puedeVer: true,
      urlDescarga: '/api/retiros/7/documentos/orden?download=1',
    });

    expect(el.textContent).toContain('orden.pdf');
    expect(accion('Ver vista previa')).toBeDefined();
    expect(el.querySelector('a[target="_blank"]')).toBeNull();
    expect(accion('Descargar')?.getAttribute('href')).toBe('/api/retiros/7/documentos/orden?download=1');
    expect(accion('Descargar')?.hasAttribute('download')).toBe(true);
  });

  it('las acciones son íconos, como en la ficha, con el archivo en su etiqueta', async () => {
    await montar({
      nombre: 'orden.pdf',
      puedeVer: true,
      urlDescarga: '/api/retiros/7/documentos/orden?download=1',
      puedeEditar: true,
    });

    for (const [titulo, etiqueta] of [
      ['Ver vista previa', 'Ver vista previa de «orden.pdf»'],
      ['Descargar', 'Descargar «orden.pdf»'],
      ['Quitar', 'Quitar «orden.pdf»'],
    ]) {
      const a = accion(titulo);
      expect(a?.getAttribute('aria-label')).toBe(etiqueta);
      expect(a?.querySelector('svg')).not.toBeNull();
      expect(a?.textContent?.trim()).toBe('');
    }
  });

  it('sin puedeVer no muestra Ver', async () => {
    await montar({ nombre: 'orden.pdf' });

    expect(accion('Ver vista previa')).toBeUndefined();
  });

  it('Ver emite verAlternado y no muestra nada por su cuenta', async () => {
    await montar({ nombre: 'orden.pdf', puedeVer: true, tipo: 'application/pdf' });
    const alternado = vi.fn();
    component.verAlternado.subscribe(alternado);

    accion('Ver vista previa')!.click();
    fixture.detectChanges();

    expect(alternado).toHaveBeenCalledTimes(1);
    expect(el.querySelector('embed')).toBeNull();
  });

  it('con visorUrl muestra el PDF en la página y Ver pasa a Ocultar', async () => {
    await montar({ nombre: 'orden.pdf', puedeVer: true, tipo: 'application/pdf' });
    fixture.componentRef.setInput('visorUrl', url('/api/retiros/7/documentos/orden'));
    fixture.detectChanges();

    const embed = el.querySelector('embed');
    expect(embed?.getAttribute('type')).toBe('application/pdf');
    expect(embed?.getAttribute('src')).toBe('/api/retiros/7/documentos/orden');
    expect(accion('Ocultar vista previa')?.getAttribute('aria-pressed')).toBe('true');
    expect(accion('Ver vista previa')).toBeUndefined();
  });

  it('una imagen se muestra con img', async () => {
    await montar({ nombre: 'boletin.png', puedeVer: true, tipo: 'image/png' });
    fixture.componentRef.setInput('visorUrl', url('/api/retiros/7/documentos/boletin'));
    fixture.detectChanges();

    expect(el.querySelector('embed')).toBeNull();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/api/retiros/7/documentos/boletin');
  });

  it('muestra Quitar solo si puedeEditar, y al tocarlo emite quitado', async () => {
    await montar({ nombre: 'orden.pdf', puedeEditar: false });
    expect(accion('Quitar')).toBeUndefined();

    TestBed.resetTestingModule();
    await montar({ nombre: 'orden.pdf', puedeEditar: true });
    const quitado = vi.fn();
    component.quitado.subscribe(quitado);
    accion('Quitar')!.click();

    expect(quitado).toHaveBeenCalledTimes(1);
  });

  it('sin documento y sin permiso no muestra Adjuntar', async () => {
    await montar({ nombre: null, puedeEditar: false });

    expect(boton('Adjuntar')).toBeUndefined();
  });

  it('Adjuntar queda deshabilitado si no está habilitado o está ocupado', async () => {
    await montar({ puedeEditar: true, habilitado: false });
    expect(boton('Adjuntar')!.disabled).toBe(true);

    fixture.componentRef.setInput('habilitado', true);
    fixture.componentRef.setInput('ocupado', true);
    fixture.detectChanges();
    expect(boton('Adjuntar')!.disabled).toBe(true);

    fixture.componentRef.setInput('ocupado', false);
    fixture.detectChanges();
    expect(boton('Adjuntar')!.disabled).toBe(false);
  });

  it('elegir un PDF válido emite elegido con el archivo', async () => {
    await montar({ puedeEditar: true });
    const elegido = vi.fn();
    component.elegido.subscribe(elegido);
    const archivo = pdf();

    elegir(archivo);

    expect(elegido).toHaveBeenCalledWith(archivo);
  });

  it('elegir un archivo de otro tipo no emite y muestra el error', async () => {
    await montar({ puedeEditar: true });
    const elegido = vi.fn();
    component.elegido.subscribe(elegido);

    elegir(new File(['hola'], 'nota.txt', { type: 'text/plain' }));

    expect(elegido).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Tipo de archivo no permitido. Solo PDF, JPG o PNG.');
  });
});
