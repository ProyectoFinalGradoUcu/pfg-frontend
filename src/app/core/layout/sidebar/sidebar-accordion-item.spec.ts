import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { SidebarAccordionItem } from './sidebar-accordion-item';
import { SidebarAccordionState } from './sidebar-accordion-state';

@Component({ standalone: true, template: '' })
class Vacia {}

@Component({
  standalone: true,
  imports: [SidebarAccordionItem],
  providers: [SidebarAccordionState],
  template: `
    <app-sidebar-accordion label="Personal" route="/personal" [children]="[{ label: 'Admin', route: '/personal' }]" />
    <app-sidebar-accordion label="Cursos" route="/cursos" [children]="[{ label: 'Listado', route: '/cursos' }]" />
  `,
})
class Host {}

// Abrir un grupo del sidebar cierra el resto: con todos abiertos la lista se desborda.
describe('SidebarAccordionItem · un solo grupo abierto', () => {
  let fixture: ComponentFixture<Host>;

  const trigger = (label: string): HTMLButtonElement =>
    [...fixture.nativeElement.querySelectorAll('.sidebar__item--trigger')].find((b: HTMLElement) =>
      b.textContent?.includes(label),
    );
  const abiertos = (): string[] =>
    [...fixture.nativeElement.querySelectorAll('.sidebar__item--open')].map((b: HTMLElement) => b.textContent!.trim());

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([
        { path: 'personal', component: Vacia },
        { path: 'cursos', component: Vacia },
      ])],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('arranca con todo cerrado y abrir uno cierra el otro', () => {
    expect(abiertos()).toEqual([]);

    trigger('Personal').click();
    fixture.detectChanges();
    expect(abiertos()).toEqual(['Personal']);

    trigger('Cursos').click();
    fixture.detectChanges();
    expect(abiertos()).toEqual(['Cursos']);
  });

  it('volver a tocar el grupo abierto lo cierra', () => {
    trigger('Personal').click();
    fixture.detectChanges();
    trigger('Personal').click();
    fixture.detectChanges();
    expect(abiertos()).toEqual([]);
  });

  it('navegar a una ruta de otro grupo abre ese y cierra el actual', async () => {
    trigger('Personal').click();
    fixture.detectChanges();

    await TestBed.inject(Router).navigateByUrl('/cursos');
    fixture.detectChanges();
    expect(abiertos()).toEqual(['Cursos']);
  });
});
