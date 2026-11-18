import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import {
  ArchivosPendientes,
  apiDocumentos,
  armarSlots,
  subirPendientes,
} from './documentos-registro';

const archivo = (nombre: string) => new File(['x'], nombre, { type: 'application/pdf' });

describe('apiDocumentos', () => {
  let http: HttpTestingController;
  const api = () => apiDocumentos(TestBed.inject(HttpClient), '/x/1');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sube con FormData y el campo archivo', () => {
    const f = archivo('a.pdf');
    api().subir('orden', f).subscribe();
    const req = http.expectOne('/x/1/documentos/orden');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('archivo')).toBe(f);
    req.flush({});
  });

  it('quita con DELETE', () => {
    api().quitar('boletin').subscribe();
    const req = http.expectOne('/x/1/documentos/boletin');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('inspecciona con HEAD', () => {
    let listo = false;
    api()
      .inspeccionar('orden')
      .subscribe(() => (listo = true));
    const req = http.expectOne('/x/1/documentos/orden');
    expect(req.request.method).toBe('HEAD');
    req.flush(null);
    expect(listo).toBe(true);
  });

  it('arma la url con y sin descarga', () => {
    expect(api().url('orden')).toBe('/x/1/documentos/orden');
    expect(api().url('orden', { descarga: true })).toBe('/x/1/documentos/orden?download=1');
  });
});

describe('subirPendientes', () => {
  it('sube en orden: orden y luego boletin', () => {
    const llamadas: string[] = [];
    const subir = (slot: string) => {
      llamadas.push(slot);
      return of({});
    };
    let completo = false;
    subirPendientes(
      subir,
      { boletin: archivo('b.pdf'), orden: archivo('o.pdf') },
      () => {},
    ).subscribe({
      complete: () => (completo = true),
    });
    expect(llamadas).toEqual(['orden', 'boletin']);
    expect(completo).toBe(true);
  });

  it('si el primero falla avisa y sube el segundo igual', () => {
    const o = archivo('o.pdf');
    const fallos: [File, HttpErrorResponse][] = [];
    const subidos: string[] = [];
    const err = new HttpErrorResponse({ status: 400 });
    let emisiones = 0;
    let completo = false;
    subirPendientes(
      (slot) => {
        subidos.push(slot);
        return slot === 'orden' ? throwError(() => err) : of({});
      },
      { orden: o, boletin: archivo('b.pdf') },
      (f, e) => fallos.push([f, e]),
    ).subscribe({ next: () => emisiones++, complete: () => (completo = true) });
    expect(fallos).toEqual([[o, err]]);
    expect(subidos).toEqual(['orden', 'boletin']);
    expect(emisiones).toBe(1);
    expect(completo).toBe(true);
  });

  it('sin archivos completa enseguida', () => {
    let emisiones = 0;
    let completo = false;
    subirPendientes(
      () => of({}),
      {},
      () => {},
    ).subscribe({
      next: () => emisiones++,
      complete: () => (completo = true),
    });
    expect(emisiones).toBe(1);
    expect(completo).toBe(true);
  });
});

describe('ArchivosPendientes', () => {
  it('borrar el numero descarta el archivo de ese slot', () => {
    const p = new ArchivosPendientes();
    const control = new FormControl<string | null>('123');
    const destroy$ = new Subject<void>();
    p.descartarSiVacio(control, 'orden', destroy$);
    p.elegir('orden', archivo('o.pdf'));
    p.elegir('boletin', archivo('b.pdf'));
    control.setValue('  ');
    expect(p.archivos().orden).toBeUndefined();
    expect(p.archivos().boletin).toBeDefined();
    expect(p.hay()).toBe(true);
    p.limpiar();
    expect(p.hay()).toBe(false);
  });

  it('deja de escuchar cuando destroy$ emite', () => {
    const p = new ArchivosPendientes();
    const control = new FormControl<string | null>('1');
    const destroy$ = new Subject<void>();
    p.descartarSiVacio(control, 'orden', destroy$);
    destroy$.next();
    p.elegir('orden', archivo('o.pdf'));
    control.setValue(null);
    expect(p.archivos().orden).toBeDefined();
  });
});

describe('armarSlots', () => {
  it('usa las etiquetas por defecto y el orden de slots', () => {
    const api = {} as never;
    const slots = armarSlots(
      api,
      { orden: null, boletin: null },
      { orden: '1', boletin: null },
      true,
    );
    expect(slots.map((s) => [s.slot, s.etiqueta, s.numero])).toEqual([
      ['orden', 'N° de orden', '1'],
      ['boletin', 'Resolución', null],
    ]);
    expect(slots[0].editable).toBe(true);
  });
});
