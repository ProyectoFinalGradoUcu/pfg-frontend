import { AuthService } from '../services/auth.service';
import { destinoInicial } from './inicio.guard';

function authCon(permisos: string[]): AuthService {
  return { hasAnyPermiso: (pedidos: string[]) => pedidos.some((p) => permisos.includes(p)) } as AuthService;
}

describe('destinoInicial', () => {
  it('elige la primera sección del menú habilitada', () => {
    expect(destinoInicial(authCon(['auditoria.ver', 'personas.ver']))).toBe('/personal');
    expect(destinoInicial(authCon(['auditoria.ver', 'roles.ver']))).toBe('/auditoria');
  });

  it('acepta la variante de unidad del permiso', () => {
    expect(destinoInicial(authCon(['vuelos.ver.unidad']))).toBe('/vuelos');
  });

  it('con solo reglas de ascenso va a reglas y no a pasibles', () => {
    expect(destinoInicial(authCon(['reglas_ascenso.ver']))).toBe('/ascensos-y-retiros/reglas');
  });

  it('con solo derecha.gestionar va a la configuración', () => {
    expect(destinoInicial(authCon(['derecha.gestionar']))).toBe('/personal/configuracion-derecha');
  });

  it('sin permisos de ninguna sección devuelve null', () => {
    expect(destinoInicial(authCon([]))).toBeNull();
    expect(destinoInicial(authCon(['ascensos.registrar']))).toBeNull();
  });
});
