import { conZoom, encuadreInicial, escalaDe, mover, recorte, ZOOM_MAXIMO } from './encuadre';

describe('encuadre', () => {
  it('una imagen horizontal arranca centrada, cubriendo el cuadrado por su alto', () => {
    const e = encuadreInicial(800, 400, 200);

    expect(escalaDe(e)).toBe(0.5);
    expect(e.x).toBe(-100);
    expect(e.y).toBe(0);
    const r = recorte(e);
    expect(r.sx).toBe(200);
    expect(r.sy).toBeCloseTo(0);
    expect(r.lado).toBe(400);
  });

  it('una imagen vertical arranca centrada, cubriendo el cuadrado por su ancho', () => {
    const e = encuadreInicial(400, 800, 200);

    expect(e.x).toBe(0);
    expect(e.y).toBe(-100);
  });

  it('al mover, la imagen nunca deja bordes vacíos', () => {
    const e = encuadreInicial(800, 400, 200);

    expect(mover(e, 500, 0).x).toBe(0);
    expect(mover(e, -500, 0).x).toBe(-200);
    expect(mover(e, 0, 50).y).toBe(0);
  });

  it('el zoom mantiene el centro y se limita entre 1 y el máximo', () => {
    const e = encuadreInicial(400, 400, 200);

    const doble = conZoom(e, 2);
    expect(recorte(doble)).toEqual({ sx: 100, sy: 100, lado: 200 });
    expect(conZoom(e, 10).zoom).toBe(ZOOM_MAXIMO);
    expect(conZoom(e, 0.2).zoom).toBe(1);
  });

  it('al alejar el zoom después de mover, vuelve a cubrir el cuadrado', () => {
    const e = mover(conZoom(encuadreInicial(400, 400, 200), 3), -1000, -1000);

    const alejado = conZoom(e, 1);
    expect(alejado.x).toBe(0);
    expect(alejado.y).toBe(0);
  });
});
