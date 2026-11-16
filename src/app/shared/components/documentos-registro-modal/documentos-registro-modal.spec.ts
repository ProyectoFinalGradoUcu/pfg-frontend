import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

import { DocumentosRegistroModal } from './documentos-registro-modal';
import { DocumentosRegistroComponent } from '../documentos-registro/documentos-registro';

describe('DocumentosRegistroModal', () => {
  let fixture: ComponentFixture<DocumentosRegistroModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocumentosRegistroModal, DocumentosRegistroComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(DocumentosRegistroModal);
    fixture.componentInstance.titulo = 'Documentos del destino';
    fixture.detectChanges();
  });

  it('muestra el título', () => {
    expect(fixture.nativeElement.querySelector('.modal__header h3').textContent).toContain(
      'Documentos del destino',
    );
  });

  it('re-emite el cambio del componente interno', () => {
    const cambio = vi.fn();
    fixture.componentInstance.cambio.subscribe(cambio);

    const interno = fixture.debugElement.query(By.directive(DocumentosRegistroComponent));
    interno.componentInstance.cambio.emit();

    expect(cambio).toHaveBeenCalledTimes(1);
  });

  it('cerrar emite cerrado', () => {
    const cerrado = vi.fn();
    fixture.componentInstance.cerrado.subscribe(cerrado);

    (fixture.nativeElement.querySelector('.modal__close') as HTMLButtonElement).click();
    const pie = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Cerrar',
    ) as HTMLButtonElement;
    pie.click();

    expect(cerrado).toHaveBeenCalledTimes(2);
  });

  it('mientras el interno está ocupado deshabilita la X y Cerrar y no emite cerrado', () => {
    const cerrado = vi.fn();
    fixture.componentInstance.cerrado.subscribe(cerrado);
    const interno = fixture.debugElement.query(By.directive(DocumentosRegistroComponent));

    interno.componentInstance.ocupadoCambio.emit(true);
    fixture.detectChanges();
    const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    botones.forEach((b) => b.click());

    expect(botones.every((b) => b.disabled)).toBe(true);
    expect(cerrado).not.toHaveBeenCalled();

    interno.componentInstance.ocupadoCambio.emit(false);
    fixture.detectChanges();
    expect(botones.every((b) => !b.disabled)).toBe(true);
  });
});
