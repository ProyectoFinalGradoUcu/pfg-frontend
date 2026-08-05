import { SeccionDetalle, formatearDetalle, formatearValor } from './detalle-auditoria';

/** Busca una sección por título, a cualquier nivel de anidamiento. */
function buscarSeccion(secciones: SeccionDetalle[], titulo: string): SeccionDetalle | undefined {
  for (const s of secciones) {
    if (s.titulo === titulo) return s;
    const encontrada = buscarSeccion(s.subsecciones, titulo);
    if (encontrada) return encontrada;
  }
  return undefined;
}

function valorDe(secciones: SeccionDetalle[], etiqueta: string): string | undefined {
  for (const s of secciones) {
    const campo = s.campos.find((c) => c.etiqueta === etiqueta);
    if (campo) return campo.valor;
    const anidado = valorDe(s.subsecciones, etiqueta);
    if (anidado !== undefined) return anidado;
  }
  return undefined;
}

describe('formatearValor', () => {
  it('Muestra los vacíos como raya', () => {
    expect(formatearValor(null)).toBe('—');
    expect(formatearValor(undefined)).toBe('—');
    expect(formatearValor('')).toBe('—');
  });

  it('Traduce los booleanos a Sí/No', () => {
    expect(formatearValor(true)).toBe('Sí');
    expect(formatearValor(false)).toBe('No');
  });

  it('Da vuelta las fechas ISO', () => {
    expect(formatearValor('1990-05-15')).toBe('15/05/1990');
  });

  it('Omite la hora cuando la fecha viene a medianoche', () => {
    expect(formatearValor('2024-01-15T00:00:00.000Z')).toBe('15/01/2024');
  });

  it('Señala los campos enmascarados por el backend', () => {
    expect(formatearValor('***')).toBe('(oculto)');
  });

  it('Deja los textos comunes como están', () => {
    expect(formatearValor('Sargento')).toBe('Sargento');
    expect(formatearValor(42)).toBe('42');
  });
});

describe('formatearDetalle', () => {
  describe('alta de personal (interceptor con incluirRespuesta)', () => {
    const detalle = {
      body: {
        cedula: '12345678',
        primer_nombre: 'Juan',
        es_civil: false,
        fecha_nacimiento: '1990-05-15',
        grado_id: 6,
      },
      resultado: {
        id: 42,
        cedula: '12345678',
        relacion_laboral: {
          grado_id: 6,
          grado: 'Sargento',
          unidad_id: 3,
          unidad: 'Brigada Aérea I',
          tiene_mando: false,
          fecha_inicio: '2024-01-15T00:00:00.000Z',
        },
      },
    };

    it('Separa los datos enviados del registro creado', () => {
      const secciones = formatearDetalle(detalle);
      expect(buscarSeccion(secciones, 'Datos enviados')).toBeDefined();
      expect(buscarSeccion(secciones, 'Registro creado')).toBeDefined();
    });

    it('Abre la relación laboral como subsección', () => {
      const secciones = formatearDetalle(detalle);
      const creado = buscarSeccion(secciones, 'Registro creado')!;
      expect(creado.subsecciones.map((s) => s.titulo)).toContain('Relación laboral');
    });

    it('Descarta el id cuando al lado viene el nombre resuelto', () => {
      const relacion = buscarSeccion(formatearDetalle(detalle), 'Relación laboral')!;
      const etiquetas = relacion.campos.map((c) => c.etiqueta);
      expect(etiquetas).toContain('Grado');
      expect(etiquetas).not.toContain('Grado (id)');
      expect(relacion.campos.find((c) => c.etiqueta === 'Grado')!.valor).toBe('Sargento');
    });

    it('Muestra el id cuando no hay nombre resuelto', () => {
      const enviados = buscarSeccion(formatearDetalle(detalle), 'Datos enviados')!;
      expect(enviados.campos.find((c) => c.etiqueta === 'Grado (id)')!.valor).toBe('6');
    });

    it('Saca el sobre HTTP de los eventos guardados antes del arreglo', () => {
      // Payload real: el ServiceResponseInterceptor global envolvía la respuesta.
      const secciones = formatearDetalle({
        body: { cedula: '99887766' },
        resultado: {
          service_response: {
            service_status: { http_status: '201', http_message: 'Created' },
            service_data: { id: 17, relacion_laboral: { grado: 'Sargento' } },
          },
        },
      });
      expect(buscarSeccion(secciones, 'Service response')).toBeUndefined();
      expect(buscarSeccion(secciones, 'Service status')).toBeUndefined();
      expect(valorDe(secciones, 'Identificador')).toBe('17');
      expect(valorDe(secciones, 'Grado')).toBe('Sargento');
    });

    it('Aplica etiquetas y formatos legibles', () => {
      const secciones = formatearDetalle(detalle);
      expect(valorDe(secciones, 'Primer nombre')).toBe('Juan');
      expect(valorDe(secciones, 'Personal civil')).toBe('No');
      expect(valorDe(secciones, 'Fecha de nacimiento')).toBe('15/05/1990');
      expect(valorDe(secciones, 'Fecha de inicio')).toBe('15/01/2024');
    });
  });

  describe('edición (interceptor con params + body)', () => {
    const detalle = {
      params: { id: '42' },
      body: { telefono: '099123456', prima_tecnica: 'A' },
    };

    it('Omite params cuando solo trae el id, que la tabla ya muestra', () => {
      const secciones = formatearDetalle(detalle);
      expect(buscarSeccion(secciones, 'Parámetros')).toBeUndefined();
      expect(secciones.length).toBe(1);
    });

    it('Conserva params si es lo único que hay, como en una baja', () => {
      // Payload real de un ELIMINAR: sin esto el modal caería al JSON crudo.
      const secciones = formatearDetalle({ params: { id: '10' } });
      expect(secciones.length).toBe(1);
      expect(valorDe(secciones, 'Identificador')).toBe('10');
    });

    it('Muestra params completo cuando trae algo más que el id', () => {
      const secciones = formatearDetalle({
        params: { id: '10', rolId: '3' },
        body: { nombre: 'x' },
      });
      expect(buscarSeccion(secciones, 'Parámetros')).toBeDefined();
      expect(valorDe(secciones, 'Rol id')).toBe('3');
    });

    it('Muestra los campos editados', () => {
      const secciones = formatearDetalle(detalle);
      expect(valorDe(secciones, 'Teléfono')).toBe('099123456');
      expect(valorDe(secciones, 'Prima técnica')).toBe('A');
    });
  });

  describe('payloads reales de la bitácora', () => {
    it('Alta de rol', () => {
      const secciones = formatearDetalle({ body: { nombre: 'Rol E2E Navegador' } });
      expect(valorDe(secciones, 'Nombre')).toBe('Rol E2E Navegador');
    });

    it('Edición de rol', () => {
      const secciones = formatearDetalle({
        body: { descripcion: 'modificado' },
        params: { id: '10' },
      });
      expect(valorDe(secciones, 'Descripción')).toBe('modificado');
      expect(secciones.length).toBe(1);
    });
  });

  describe('registros manuales', () => {
    it('Agrupa el login fallido en una sección sin título', () => {
      const secciones = formatearDetalle({ username: 'jperez', motivo: 'contraseña incorrecta' });
      expect(secciones.length).toBe(1);
      expect(secciones[0].titulo).toBeNull();
      expect(valorDe(secciones, 'Usuario')).toBe('jperez');
      expect(valorDe(secciones, 'Motivo')).toBe('contraseña incorrecta');
    });

    it('Etiqueta las claves camelCase de invitaciones', () => {
      const secciones = formatearDetalle({
        email: 'a@b.com',
        viaInvitacion: true,
        invitacionId: '7',
      });
      expect(valorDe(secciones, 'Alta por invitación')).toBe('Sí');
      expect(valorDe(secciones, 'Invitación')).toBe('7');
    });
  });

  describe('listas', () => {
    it('Numera una lista de objetos', () => {
      const secciones = formatearDetalle({
        body: { familiares: [{ cedula: '111' }, { cedula: '222' }] },
      });
      expect(buscarSeccion(secciones, 'Familiares 1')).toBeDefined();
      expect(buscarSeccion(secciones, 'Familiares 2')).toBeDefined();
    });

    it('Junta una lista de valores simples en una línea', () => {
      const secciones = formatearDetalle({ body: { permisos: ['ver', 'editar'] } });
      expect(valorDe(secciones, 'Permisos')).toBe('ver, editar');
    });

    it('Marca las listas vacías', () => {
      const secciones = formatearDetalle({ body: { familiares: [] } });
      expect(buscarSeccion(secciones, 'Familiares')!.campos[0].valor).toBe('—');
    });
  });

  describe('formas inesperadas', () => {
    it('Devuelve vacío para null, para que la vista caiga al JSON', () => {
      expect(formatearDetalle(null)).toEqual([]);
      expect(formatearDetalle(undefined)).toEqual([]);
    });

    it('Devuelve vacío para valores que no son objeto', () => {
      expect(formatearDetalle('texto suelto')).toEqual([]);
      expect(formatearDetalle([1, 2, 3])).toEqual([]);
    });

    it('Devuelve vacío para un objeto sin contenido', () => {
      expect(formatearDetalle({})).toEqual([]);
    });

    it('Etiqueta por defecto las claves que no están en el diccionario', () => {
      const secciones = formatearDetalle({ body: { porcentaje_progresivo: '0.15' } });
      expect(valorDe(secciones, 'Porcentaje progresivo')).toBe('0.15');
    });
  });
});
