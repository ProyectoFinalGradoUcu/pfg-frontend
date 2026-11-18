import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  DocumentoPersonal,
  esImagen,
  esPdf,
  formatearFecha,
  formatearFechaHora,
  formatearTamanio,
  tipoDocumento,
  tituloDocumento,
  validarArchivo,
} from './documentos-personal.models';

function archivo(nombre: string, tipo: string, tamanio = 1024): File {
  const f = new File(['x'], nombre, { type: tipo });
  Object.defineProperty(f, 'size', { value: tamanio });
  return f;
}

function makeDocumento(overrides: Partial<DocumentoPersonal> = {}): DocumentoPersonal {
  return {
    id: '12',
    descripcion: 'Cédula, frente y dorso',
    nombre_original: 'Cédula frente.pdf',
    content_type: 'application/pdf',
    tamanio_bytes: '184223',
    subido_en: '2026-09-30T19:40:00.000Z',
    subido_por: { id: '1', username: 'admin@fau.mil.uy' },
    ...overrides,
  };
}

const TIPO_NO_PERMITIDO = 'Tipo de archivo no permitido. Solo PDF, JPG o PNG.';

describe('validarArchivo', () => {
  it('acepta PDF, JPG y PNG', () => {
    expect(validarArchivo(archivo('cedula.pdf', 'application/pdf'))).toBeNull();
    expect(validarArchivo(archivo('foto.jpg', 'image/jpeg'))).toBeNull();
    expect(validarArchivo(archivo('foto.jpeg', 'image/jpeg'))).toBeNull();
    expect(validarArchivo(archivo('scan.png', 'image/png'))).toBeNull();
  });

  it('acepta la extensión en mayúsculas', () => {
    expect(validarArchivo(archivo('CEDULA.PDF', 'application/pdf'))).toBeNull();
  });

  it('acepta exactamente 10 MB y rechaza un byte más', () => {
    expect(validarArchivo(archivo('a.pdf', 'application/pdf', DOCUMENTO_TAMANIO_MAXIMO_BYTES))).toBeNull();
    expect(validarArchivo(archivo('a.pdf', 'application/pdf', DOCUMENTO_TAMANIO_MAXIMO_BYTES + 1)))
      .toBe('El archivo supera el tamaño máximo de 10 MB.');
  });

  it('rechaza un tipo permitido con una extensión que no lo es', () => {
    expect(validarArchivo(archivo('cedula.txt', 'application/pdf'))).toBe(TIPO_NO_PERMITIDO);
  });

  it('rechaza una extensión permitida con un tipo que no lo es', () => {
    expect(validarArchivo(archivo('foto.png', 'image/gif'))).toBe(TIPO_NO_PERMITIDO);
  });

  it('rechaza un archivo sin tipo, como una carpeta arrastrada', () => {
    expect(validarArchivo(archivo('carpeta', ''))).toBe(TIPO_NO_PERMITIDO);
  });
});

describe('formatearTamanio', () => {
  it('formatea bytes, KB y MB, con string o número', () => {
    expect(formatearTamanio(512)).toBe('512 B');
    expect(formatearTamanio('184223')).toBe('179.9 KB');
    expect(formatearTamanio(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('devuelve vacío si no es un número', () => {
    expect(formatearTamanio('abc')).toBe('');
  });
});

describe('formatearFechaHora', () => {
  it('formatea dd/mm/aaaa hh:mm en hora local', () => {
    const iso = new Date(2026, 8, 30, 16, 5).toISOString();
    expect(formatearFechaHora(iso)).toBe('30/09/2026 16:05');
  });

  it('devuelve — si la fecha no es válida', () => {
    expect(formatearFechaHora('no-es-fecha')).toBe('—');
  });
});

describe('formatearFecha', () => {
  it('formatea dd/mm/aaaa en hora local, sin la hora', () => {
    const iso = new Date(2026, 8, 30, 23, 50).toISOString();
    expect(formatearFecha(iso)).toBe('30/09/2026');
  });

  it('devuelve — si la fecha no es válida', () => {
    expect(formatearFecha('no-es-fecha')).toBe('—');
  });
});

describe('tipoDocumento', () => {
  it('nombra el tipo como lo conoce el usuario', () => {
    expect(tipoDocumento({ content_type: 'application/pdf' })).toBe('PDF');
    expect(tipoDocumento({ content_type: 'image/jpeg' })).toBe('JPG');
    expect(tipoDocumento({ content_type: 'image/png' })).toBe('PNG');
  });

  it('si llega otro tipo, lo muestra tal cual', () => {
    expect(tipoDocumento({ content_type: 'image/webp' })).toBe('image/webp');
  });
});

describe('tituloDocumento', () => {
  it('es la descripción, o el nombre del archivo si no tiene', () => {
    expect(tituloDocumento(makeDocumento())).toBe('Cédula, frente y dorso');
    expect(tituloDocumento(makeDocumento({ descripcion: null }))).toBe('Cédula frente.pdf');
  });
});

describe('esPdf / esImagen', () => {
  it('distingue por content_type', () => {
    expect(esPdf({ content_type: 'application/pdf' })).toBe(true);
    expect(esImagen({ content_type: 'application/pdf' })).toBe(false);
    expect(esImagen({ content_type: 'image/png' })).toBe(true);
    expect(esPdf({ content_type: 'image/jpeg' })).toBe(false);
  });
});
