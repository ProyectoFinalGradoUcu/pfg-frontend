import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LoginPage } from './login-page';
import { AuthService } from '../../../../core/services/auth.service';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [LoginPage],
      imports: [RouterTestingModule, HttpClientTestingModule, ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('mensaje de error del login', () => {
    const responder401 = (httpMessage: string) => {
      const auth = TestBed.inject(AuthService);
      vi.spyOn(auth, 'signIn').mockReturnValue(
        throwError(() => new HttpErrorResponse({
          status: 401,
          error: { service_response: { service_status: { http_status: '401', http_message: httpMessage }, service_data: null } },
        })),
      );
      component.form.setValue({ username: 'a@b.com', password: '123456' });
      component.submit();
    };

    it('a un usuario bloqueado le muestra "Usuario bloqueado"', () => {
      responder401('Usuario bloqueado');
      expect(component.errorMessage()).toBe('Usuario bloqueado');
    });

    it('al bloqueado temporalmente también le muestra el motivo', () => {
      responder401('Usuario bloqueado temporalmente');
      expect(component.errorMessage()).toBe('Usuario bloqueado temporalmente');
    });

    it('con credenciales inválidas no revela cuál de los dos datos falló', () => {
      responder401('Credenciales inválidas');
      expect(component.errorMessage()).toBe('Usuario o contraseña incorrectos');
    });
  });
});
