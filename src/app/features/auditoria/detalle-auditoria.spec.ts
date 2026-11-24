import { SeccionDetalle, etiquetaDe, formatearDetalle, formatearValor, resumenDe, textoAccion, textoEntidad } from './detalle-auditoria';

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

  it('Muestra los timestamps en hora de Uruguay', () => {
    expect(formatearValor('2026-11-22T22:46:00.000Z')).toBe('22/11/2026 19:46');
    expect(formatearValor('2026-11-23T01:30:00.000Z')).toBe('22/11/2026 22:30');
  });

  it('Señala los campos enmascarados por el backend', () => {
    expect(formatearValor('***')).toBe('(oculto)');
  });

  it('Deja los textos comunes como están', () => {
    expect(formatearValor('Sargento')).toBe('Sargento');
    expect(formatearValor(42)).toBe('42');
  });

  it('Junta las listas en una línea', () => {
    expect(formatearValor(['Cabo', 'Sargento'])).toBe('Cabo, Sargento');
    expect(formatearValor([])).toBe('—');
  });
});

describe('textoAccion', () => {
  it('Traduce las acciones de la bitácora', () => {
    expect(textoAccion('CREAR')).toBe('Creó');
    expect(textoAccion('ACTUALIZAR')).toBe('Modificó');
    expect(textoAccion('DESASIGNAR')).toBe('Quitó');
    expect(textoAccion('LOGIN_FALLIDO')).toBe('Intento de ingreso fallido');
    expect(textoAccion('RESETEAR_PASSWORD')).toBe('Restableció la contraseña');
  });

  it('Traduce las acciones con punto', () => {
    expect(textoAccion('ascenso.anular')).toBe('Anuló un ascenso');
    expect(textoAccion('orden_ascenso.anular')).toBe('Anuló una orden de ascenso');
    expect(textoAccion('unidad_rol.agregar')).toBe('Agregó un rol a la unidad');
    expect(textoAccion('reportes.ejecutar')).toBe('Ejecutó un reporte');
  });

  it('Humaniza las acciones desconocidas', () => {
    expect(textoAccion('mision.cerrar_convocatoria')).toBe('Mision cerrar convocatoria');
    expect(textoAccion('EXPORTAR_TODO')).toBe('Exportar todo');
  });
});

describe('textoEntidad', () => {
  it('Traduce los nombres de tabla', () => {
    expect(textoEntidad('ascensos_ordenes')).toBe('Orden de ascenso');
    expect(textoEntidad('personas')).toBe('Persona');
    expect(textoEntidad('Regla de ascenso')).toBe('Regla de ascenso');
    expect(textoEntidad(null)).toBeNull();
  });
});

describe('resumenDe', () => {
  const base = { accion: 'ACTUALIZAR', entidad: 'Persona', detalle: null };

  it('Usa el resumen del backend', () => {
    expect(resumenDe({ ...base, resumen: 'Modificó la persona Sgto. Juan Pérez' })).toBe(
      'Modificó la persona Sgto. Juan Pérez',
    );
  });

  it('Usa la descripción del detalle si no hay resumen', () => {
    expect(resumenDe({ ...base, resumen: null, detalle: { descripcion: 'Eliminó el rol Administrador' } })).toBe(
      'Eliminó el rol Administrador',
    );
  });

  it('Arma acción y entidad cuando no viene nada', () => {
    expect(resumenDe(base)).toBe('Modificó · Persona');
  });

  it('Suma el nombre de la entidad si viene', () => {
    expect(resumenDe({ ...base, accion: 'CREAR', entidad: 'misiones', entidadNombre: 'Antártida' })).toBe(
      'Creó · Misión · Antártida',
    );
  });

  it('Sin entidad queda solo la acción', () => {
    expect(resumenDe({ accion: 'LOGIN_FALLIDO', entidad: null, detalle: {} })).toBe('Intento de ingreso fallido');
  });
});

describe('formatearDetalle', () => {
  describe('alta de personal (interceptor con incluirRespuesta)', () => {
    const crear = { accion: 'CREAR' };
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
      const secciones = formatearDetalle(detalle, crear);
      expect(buscarSeccion(secciones, 'Datos enviados')).toBeDefined();
      expect(buscarSeccion(secciones, 'Registro creado')).toBeDefined();
    });

    it('Abre la relación laboral como subsección', () => {
      const secciones = formatearDetalle(detalle, crear);
      const creado = buscarSeccion(secciones, 'Registro creado')!;
      expect(creado.subsecciones.map((s) => s.titulo)).toContain('Relación laboral');
    });

    it('Descarta el id cuando al lado viene el nombre resuelto', () => {
      const relacion = buscarSeccion(formatearDetalle(detalle, crear), 'Relación laboral')!;
      const etiquetas = relacion.campos.map((c) => c.etiqueta);
      expect(etiquetas).toContain('Grado');
      expect(etiquetas).not.toContain('Grado (id)');
      expect(relacion.campos.find((c) => c.etiqueta === 'Grado')!.valor).toBe('Sargento');
    });

    it('Oculta el id cuando no hay nombre resuelto', () => {
      const enviados = buscarSeccion(formatearDetalle(detalle, crear), 'Datos enviados')!;
      expect(enviados.campos.map((c) => c.etiqueta)).not.toContain('Grado');
      expect(valorDe(formatearDetalle(detalle, crear), 'Identificador')).toBeUndefined();
    });

    it('Muestra el nombre del id cuando el backend lo resolvió', () => {
      const enviados = buscarSeccion(
        formatearDetalle(detalle, { ...crear, nombres: { 'grado_id:6': 'Sargento' } }),
        'Datos enviados',
      )!;
      expect(enviados.campos.find((c) => c.etiqueta === 'Grado')!.valor).toBe('Sargento');
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
      expect(valorDe(secciones, 'Grado')).toBe('Sargento');
    });

    it('Saca el sobre service_request del body', () => {
      const secciones = formatearDetalle({ body: { service_request: { nombre: 'Base Aérea N°1', comando_id: 3 } } });
      expect(buscarSeccion(secciones, 'Service request')).toBeUndefined();
      expect(buscarSeccion(secciones, 'Datos enviados')!.campos).toEqual([
        { etiqueta: 'Nombre', valor: 'Base Aérea N°1' },
      ]);
    });

    it('Aplica etiquetas y formatos legibles', () => {
      const secciones = formatearDetalle(detalle, crear);
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

    it('En una baja sin nombres no queda nada legible', () => {
      expect(formatearDetalle({ params: { id: '10' } })).toEqual([]);
    });

    it('En una baja muestra el registro por su nombre', () => {
      const secciones = formatearDetalle({ params: { id: '10' } }, { nombres: { 'id:10': 'Administrador' }, entidad: 'Rol' });
      expect(valorDe(secciones, 'Rol')).toBe('Administrador');
    });

    it('Omite params cuando hay otros datos', () => {
      const secciones = formatearDetalle(
        { params: { id: '10', rolId: '3' }, body: { nombre: 'x' } },
        { nombres: { 'rolId:3': 'Administrador' } },
      );
      expect(secciones.length).toBe(1);
      expect(valorDe(secciones, 'Rol')).toBeUndefined();
    });

    it('Muestra los campos editados', () => {
      const secciones = formatearDetalle(detalle);
      expect(valorDe(secciones, 'Teléfono')).toBe('099123456');
      expect(valorDe(secciones, 'Prima técnica')).toBe('A');
    });

    it('Muestra la columna boletin como resolución', () => {
      const secciones = formatearDetalle({
        params: { id: '10', slot: 'boletin' },
        body: { boletin: 'R. 12', fecha_boletin: '2026-11-18' },
      });
      expect(valorDe(secciones, 'Resolución')).toBe('R. 12');
      expect(valorDe(secciones, 'Fecha de resolución')).toBe('18/11/2026');
    });

    it('Muestra el documento como resolución si params es lo único', () => {
      const secciones = formatearDetalle({ params: { id: '10', slot: 'boletin' } });
      expect(valorDe(secciones, 'Documento')).toBe('Resolución');
      expect(valorDe(secciones, 'Identificador')).toBeUndefined();
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
      const detalle = { email: 'a@b.com', viaInvitacion: true, invitacionId: '7' };
      expect(valorDe(formatearDetalle(detalle), 'Alta por invitación')).toBe('Sí');
      expect(valorDe(formatearDetalle(detalle), 'Invitación')).toBeUndefined();
      const conNombre = formatearDetalle(detalle, { nombres: { 'invitacionId:7': 'a@b.com' } });
      expect(valorDe(conNombre, 'Invitación')).toBe('a@b.com');
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
      const secciones = formatearDetalle({ familiares: [] });
      expect(valorDe(secciones, 'Familiares')).toBe('—');
    });
  });

  describe('cambios, anterior y nombres', () => {
    it('Pone los cambios primero, uno por línea', () => {
      const secciones = formatearDetalle({
        body: { telefono: '099' },
        cambios: [
          { campo: 'grado', anterior: 'Cabo', nuevo: 'Sargento' },
          { campo: 'telefono', anterior: null, nuevo: '099' },
          { campo: 'tiene_mando', anterior: false, nuevo: true },
          { campo: 'fecha_inicio', anterior: '2024-01-15', nuevo: '2025-03-01' },
        ],
      });
      expect(secciones[0].titulo).toBe('Cambios');
      expect(secciones[0].campos).toEqual([
        { etiqueta: 'Grado', valor: 'Cabo → Sargento' },
        { etiqueta: 'Teléfono', valor: '— → 099' },
        { etiqueta: 'Tiene mando', valor: 'No → Sí' },
        { etiqueta: 'Fecha de inicio', valor: '15/01/2024 → 01/03/2025' },
      ]);
    });

    it('No repite cambios, anterior ni descripción como otros datos', () => {
      const secciones = formatearDetalle({
        descripcion: 'Modificó la persona Sgto. Juan Pérez',
        cambios: [{ campo: 'telefono', anterior: '1', nuevo: '2' }],
        anterior: { nombre: 'x' },
      });
      expect(buscarSeccion(secciones, 'Otros datos')).toBeUndefined();
      expect(valorDe(secciones, 'Descripción')).toBeUndefined();
      expect(secciones.map((s) => s.titulo)).toEqual(['Cambios', 'Datos anteriores']);
    });

    it('Muestra el registro eliminado', () => {
      const secciones = formatearDetalle(
        { params: { id: '4' }, anterior: { nombre: 'Administrador', descripcion: 'Todo' } },
        { accion: 'ELIMINAR' },
      );
      expect(secciones.length).toBe(1);
      expect(secciones[0].titulo).toBe('Registro eliminado');
      expect(valorDe(secciones, 'Nombre')).toBe('Administrador');
    });

    it('Titula los datos de una anulación', () => {
      const secciones = formatearDetalle(
        { anterior: { persona: 'Cbo. Ana Gómez', fecha_retiro: '2026-01-10' } },
        { accion: 'retiro.anular' },
      );
      expect(secciones[0].titulo).toBe('Datos antes de anular');
      expect(valorDe(secciones, 'Fecha de retiro')).toBe('10/01/2026');
    });

    it('Resuelve ids camelCase y listas de ids', () => {
      const secciones = formatearDetalle(
        { body: { personaId: '123', persona_ids: [1, 2, 3], motivo: 'x' } },
        { nombres: { 'personaId:123': 'Sgto. Juan Pérez', 'persona_ids:1': 'Cbo. Ana', 'persona_ids:2': 'Sgto. Luis' } },
      );
      expect(valorDe(secciones, 'Persona')).toBe('Sgto. Juan Pérez');
      expect(valorDe(secciones, 'Personas')).toBe('Cbo. Ana, Sgto. Luis');
    });

    it('Oculta las listas de ids sin nombres', () => {
      const secciones = formatearDetalle({ body: { modulo_ids: [1, 2], nombre: 'Curso' } });
      expect(valorDe(secciones, 'Módulos')).toBeUndefined();
      expect(buscarSeccion(secciones, 'Datos enviados')!.campos).toEqual([{ etiqueta: 'Nombre', valor: 'Curso' }]);
    });

    it('Resuelve ids dentro de objetos anidados', () => {
      const secciones = formatearDetalle(
        { resultado: { relacion_laboral: { sub_unidad_id: 12, tiene_mando: true } } },
        { nombres: { 'sub_unidad_id:12': 'Base Aérea N°1' } },
      );
      expect(valorDe(secciones, 'Sub-unidad')).toBe('Base Aérea N°1');
    });

    it('Ignora cambios con forma rara y los deja como otros datos', () => {
      const secciones = formatearDetalle({ body: { nombre: 'x' }, cambios: 'texto' });
      expect(buscarSeccion(secciones, 'Cambios')).toBeUndefined();
      expect(valorDe(secciones, 'Cambios')).toBe('texto');
    });
  });

  describe('formas inesperadas', () => {
    it('Devuelve vacío para null', () => {
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
      const secciones = formatearDetalle({ body: { cantidad_vuelos: '3' } });
      expect(valorDe(secciones, 'Cantidad vuelos')).toBe('3');
    });
  });
});

describe('formatearDetalle sobre eventos reales', () => {
  const titulos = (secciones: SeccionDetalle[]) => secciones.map((s) => s.titulo);

  describe('respuesta del servidor', () => {
    it('Solo las altas titulan el registro creado', () => {
      const secciones = formatearDetalle({ resultado: { nombre: 'Jefes' } }, { accion: 'CREAR' });
      expect(titulos(secciones)).toEqual(['Registro creado']);
    });

    it('En una baja con foto no repite la respuesta', () => {
      const secciones = formatearDetalle(
        { params: { id: '73' }, anterior: { cargo: 'Presidente' }, resultado: { id: '73', eliminado: true } },
        { accion: 'ELIMINAR' },
      );
      expect(titulos(secciones)).toEqual(['Registro eliminado']);
      expect(valorDe(secciones, 'Eliminado')).toBeUndefined();
    });

    it('En una edición con cambios no repite la respuesta', () => {
      const secciones = formatearDetalle(
        { cambios: [{ campo: 'cargo', anterior: 'Vocal', nuevo: 'Presidente' }], resultado: { cargo: 'Presidente' } },
        { accion: 'ACTUALIZAR' },
      );
      expect(titulos(secciones)).toEqual(['Cambios']);
    });

    it('Sin cambios ni foto la titula resultado', () => {
      const secciones = formatearDetalle({ resultado: { eliminado: true } }, { accion: 'ELIMINAR' });
      expect(titulos(secciones)).toEqual(['Resultado']);
      expect(valorDe(secciones, 'Eliminado')).toBe('Sí');
    });
  });

  describe('etiquetas de los cambios', () => {
    it('Usa la etiqueta del backend tal cual', () => {
      const secciones = formatearDetalle({
        cambios: [{ campo: 'calificacion', etiqueta: 'Calificación de Sgto. 1° Juan Pérez', anterior: null, nuevo: 8 }],
      });
      expect(secciones[0].campos).toEqual([{ etiqueta: 'Calificación de Sgto. 1° Juan Pérez', valor: '— → 8' }]);
    });

    it('No humaniza un nombre de persona', () => {
      expect(etiquetaDe('Sgto. 1° Test E2E')).toBe('Sgto. 1° Test E2E');
    });

    it('Abre por dato los cambios viejos con objetos', () => {
      const secciones = formatearDetalle({
        cambios: [{
          campo: 'Sgto. 1° Test E2E',
          anterior: { aprobado: null, observacion: null, calificacion: null },
          nuevo: { aprobado: false, observacion: null, calificacion: 4 },
        }],
      });
      expect(secciones[0].campos).toEqual([
        { etiqueta: 'Resultado de Sgto. 1° Test E2E', valor: '— → No' },
        { etiqueta: 'Calificación de Sgto. 1° Test E2E', valor: '— → 4' },
      ]);
    });

    it('Nunca muestra JSON en un valor', () => {
      expect(formatearValor({ calificacion: 8, aprobado: true })).toBe('Calificación: 8; Resultado: Sí');
      expect(formatearValor({ id: '1', codigo: 'SGTO', orden: 3, denominacion: 'Sgto.' })).toBe('Sgto.');
      expect(formatearValor({ id: '1' })).toBe('—');
    });
  });

  describe('etiquetas', () => {
    it('Traduce las claves con tilde', () => {
      expect(etiquetaDe('institucion')).toBe('Institución');
      expect(etiquetaDe('categoria')).toBe('Categoría');
      expect(etiquetaDe('periodo')).toBe('Período');
      expect(etiquetaDe('anio')).toBe('Año');
      expect(etiquetaDe('resolucion_cje')).toBe('Resolución CJE');
      expect(etiquetaDe('por_excepcion')).toBe('Por excepción');
      expect(etiquetaDe('cumplia_requisitos')).toBe('Cumplía los requisitos');
      expect(etiquetaDe('antiguedad_dias')).toBe('Antigüedad (días)');
      expect(etiquetaDe('posicion_destino')).toBe('Posición del destino');
      expect(etiquetaDe('codigos_legajo')).toBe('Códigos de legajo');
      expect(etiquetaDe('unidad_vuelo')).toBe('Unidad de vuelo');
      expect(etiquetaDe('tipo_ascenso')).toBe('Tipo de ascenso');
      expect(etiquetaDe('despues')).toBe('Después');
    });

    it('Unifica las fechas de inicio y fin', () => {
      expect(etiquetaDe('fechaInicio')).toBe(etiquetaDe('fecha_inicio'));
      expect(etiquetaDe('fechaFin')).toBe(etiquetaDe('fecha_fin'));
    });

    it('Deja una sola etiqueta repetida con el mismo valor', () => {
      const secciones = formatearDetalle({ fecha_boletin: '2026-01-12', fecha_resolucion: '2026-01-12' });
      expect(secciones[0].campos).toEqual([{ etiqueta: 'Fecha de resolución', valor: '12/01/2026' }]);
    });

    it('Se queda con el valor cargado de una etiqueta repetida', () => {
      const secciones = formatearDetalle({ fecha_boletin: null, fecha_resolucion: '2026-01-12' });
      expect(secciones[0].campos).toEqual([{ etiqueta: 'Fecha de resolución', valor: '12/01/2026' }]);
    });

    it('Numera una etiqueta repetida con valores distintos', () => {
      const secciones = formatearDetalle({ fecha_boletin: '2026-01-12', fecha_resolucion: '2026-02-01' });
      expect(secciones[0].campos).toEqual([
        { etiqueta: 'Fecha de resolución', valor: '12/01/2026' },
        { etiqueta: 'Fecha de resolución (2)', valor: '01/02/2026' },
      ]);
    });
  });

  describe('códigos', () => {
    it('Traduce los códigos guardados', () => {
      const secciones = formatearDetalle({
        tipo_funcionario: 'subalterno',
        categoria: 'oficial',
        estado: 'NO_REALIZADO',
        tipo: 'CURSO_APROBADO',
        tipo_ascenso: 'SIGUIENTE',
        cambio: 'LICENCIA_SIN_GOCE',
        nivel_educativo: 'BACHILLERATO',
        fuente: 'misiones',
        prima_tecnica: 'VACIO',
      });
      expect(secciones[0].campos.map((c) => c.valor)).toEqual([
        'Subalterno', 'Oficial', 'No realizado', 'Curso aprobado', 'Al grado siguiente',
        'Licencia sin goce de sueldo', 'Bachillerato', 'Misiones', '—',
      ]);
    });

    it('Traduce los estados de la carga masiva', () => {
      expect(formatearDetalle({ estado: 'ok' })[0].campos[0].valor).toBe('Correcto');
      expect(formatearDetalle({ estado: 'error' })[0].campos[0].valor).toBe('Con error');
    });

    it('Traduce los códigos dentro de los cambios', () => {
      const secciones = formatearDetalle({ cambios: [{ campo: 'nivel_educativo', anterior: null, nuevo: 'CICLO_BASICO' }] });
      expect(secciones[0].campos[0].valor).toBe('— → Ciclo básico');
    });

    it('Saca los guiones bajos de un código desconocido', () => {
      expect(formatearDetalle({ estado: 'EN_REVISION' })[0].campos[0].valor).toBe('En revision');
    });
  });

  describe('claves técnicas y vacíos', () => {
    it('Oculta paginación, banderas internas y versiones', () => {
      const secciones = formatearDetalle(
        {
          resultado: {
            numero_orden: 'OA-1', page: 1, page_size: 10, pageSize: 10, total: 2, importada: false, futura: false,
            texto_original: null, es_por_defecto: false, version: 3, versiones_anteriores: [{ notas: 'x' }],
          },
        },
        { accion: 'CREAR' },
      );
      expect(secciones[0].campos).toEqual([{ etiqueta: 'Número de orden', valor: 'OA-1' }]);
      expect(secciones[0].subsecciones).toEqual([]);
    });

    it('Muestra el total cuando no es paginación', () => {
      expect(valorDe(formatearDetalle({ resultado: { total: 3, errores: 1 } }, { accion: 'CREAR' }), 'Total')).toBe('3');
    });

    it('Muestra un grado anidado por su nombre', () => {
      const secciones = formatearDetalle(
        { resultado: { grado_origen: { id: '25', orden: 0, codigo: 'SDO_2DA', denominacion: 'Sdo. 2ª' } } },
        { accion: 'CREAR' },
      );
      expect(secciones[0].campos).toEqual([{ etiqueta: 'Grado de origen', valor: 'Sdo. 2ª' }]);
    });

    it('Oculta el código si está la denominación', () => {
      const secciones = formatearDetalle({ codigo: 'BAI', denominacion: 'B.A.I.', vigente: true });
      expect(valorDe(secciones, 'Código')).toBeUndefined();
      expect(valorDe(secciones, 'Denominación')).toBe('B.A.I.');
    });

    it('Muestra el número de la orden aunque se llame orden', () => {
      const secciones = formatearDetalle({ anterior: { orden: 'OA-1', grado: 'Sgto. 1°' } }, { accion: 'ascenso.anular' });
      expect(valorDe(secciones, 'Orden')).toBe('OA-1');
    });

    it('Oculta los vacíos en las fotos', () => {
      const secciones = formatearDetalle(
        { anterior: { cedula: '123', telefono: null, roles: [], direccion: '' } },
        { accion: 'ELIMINAR' },
      );
      expect(secciones[0].campos).toEqual([{ etiqueta: 'Cédula', valor: '123' }]);
    });

    it('Oculta los vacíos en los datos enviados y en el registro creado', () => {
      const secciones = formatearDetalle(
        { body: { nombre: 'x', notas: null }, resultado: { nombre: 'x', notas: null } },
        { accion: 'CREAR' },
      );
      expect(valorDe(secciones, 'Notas')).toBeUndefined();
    });

    it('Mantiene los vacíos en los cambios', () => {
      const secciones = formatearDetalle({ cambios: [{ campo: 'telefono', anterior: '099', nuevo: null }] });
      expect(secciones[0].campos).toEqual([{ etiqueta: 'Teléfono', valor: '099 → —' }]);
    });

    it('No muestra una foto que queda vacía', () => {
      const secciones = formatearDetalle({ anterior: { telefono: null, page: 1 } }, { accion: 'ELIMINAR' });
      expect(secciones).toEqual([]);
    });
  });

  describe('números', () => {
    it('Muestra los porcentajes', () => {
      expect(valorDe(formatearDetalle({ porcentaje_progresivo: 0.3 }), 'Porcentaje progresivo')).toBe('30 %');
      expect(valorDe(formatearDetalle({ porcentaje_progresivo: '0.15' }), 'Porcentaje progresivo')).toBe('15 %');
    });

    it('Muestra los montos con separadores', () => {
      expect(valorDe(formatearDetalle({ haber_retiro: 45000.5 }), 'Haber de retiro')).toBe('45.000,50');
      const secciones = formatearDetalle({ cambios: [{ campo: 'haber_retiro', anterior: null, nuevo: '1200' }] });
      expect(secciones[0].campos[0].valor).toBe('— → 1.200,00');
    });

    it('Muestra el tamaño de los archivos', () => {
      expect(valorDe(formatearDetalle({ tamanio_bytes: '193' }), 'Tamaño')).toBe('193 B');
      expect(valorDe(formatearDetalle({ tamanio_bytes: 1229 }), 'Tamaño')).toBe('1,2 KB');
      expect(valorDe(formatearDetalle({ tamanio_bytes: 3565158 }), 'Tamaño')).toBe('3,4 MB');
    });
  });

  describe('listas y títulos', () => {
    it('Pone las listas simples dentro de su sección', () => {
      const secciones = formatearDetalle(
        { anterior: { usuario: 'a@b.com', bases: ['B.A.I.', 'B.A.II.'] } },
        { accion: 'ELIMINAR' },
      );
      expect(secciones.length).toBe(1);
      expect(secciones[0].subsecciones).toEqual([]);
      expect(secciones[0].campos).toContainEqual({ etiqueta: 'Bases', valor: 'B.A.I., B.A.II.' });
    });

    it('Titula como datos anteriores al quitar', () => {
      const secciones = formatearDetalle(
        { anterior: { familiar: 'Sgto. Ana Gómez', tipo_relacion: 'Hijo' } },
        { accion: 'DESASIGNAR' },
      );
      expect(titulos(secciones)).toEqual(['Datos anteriores']);
    });
  });
});
