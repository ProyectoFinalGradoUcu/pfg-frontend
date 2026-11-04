import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RouterModule, provideRouter } from '@angular/router';

import { NotFoundPage } from './not-found-page';
import { AuthService } from '../../../../core/services/auth.service';

describe('NotFoundPage', () => {
  let fixture: ComponentFixture<NotFoundPage>;
  const sesion = signal(true);

  beforeEach(async () => {
    sesion.set(true);
    await TestBed.configureTestingModule({
      declarations: [NotFoundPage],
      imports: [RouterModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: { isAuthenticated: sesion } }],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra el mensaje en español', () => {
    const el = render();
    expect(el.querySelector('h1')?.textContent).toContain('Página no encontrada');
  });

  it('con sesión ofrece volver al inicio, dentro del layout', () => {
    const el = render();
    const accion = el.querySelector('.not-found__action');
    expect(accion?.getAttribute('href')).toBe('/dashboard');
    expect(el.querySelector('.not-found--suelta')).toBeNull();
  });

  it('sin sesión ofrece ir al login y se dibuja a pantalla completa', () => {
    sesion.set(false);
    const el = render();
    const accion = el.querySelector('.not-found__action');
    expect(accion?.getAttribute('href')).toBe('/auth/login');
    expect(el.querySelector('.not-found--suelta')).not.toBeNull();
  });
});
