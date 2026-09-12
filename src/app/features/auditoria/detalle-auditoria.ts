/**
 * Traduce el `detalle` crudo de un evento de auditoría a texto legible.
 * Acá se normaliza todo a secciones de pares etiqueta/valor.
 */

export interface CampoDetalle {
  etiqueta: string;
  valor: string;
}

export interface SeccionDetalle {
  titulo: string | null;
  campos: CampoDetalle[];
  subsecciones: SeccionDetalle[];
}

/** Títulos de las claves de primer nivel que arma el interceptor. */
const TITULOS_RAIZ: Record<string, string> = {
  body: 'Datos enviados',
  resultado: 'Registro creado',
  params: 'Parámetros',
};

/**
 * Etiquetas de los campos que aparecen en los módulos auditados. Lo que no
 * esté acá cae en `etiquetaPorDefecto`,
 */
const ETIQUETAS: Record<string, string> = {
  id: 'Identificador',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  genero: 'Género',
  descripcion: 'Descripción',
  denominacion: 'Denominación',
  aprobado: 'Resultado',
  calificacion: 'Calificación',
  observacion_calificacion: 'Observación',
  situacion: 'Situación',
  regimen: 'Régimen',
  escalafon: 'Escalafón',
  numero: 'Número',
  // Persona
  cedula: 'Cédula',
  primer_nombre: 'Primer nombre',
  segundo_nombre: 'Segundo nombre',
  primer_apellido: 'Primer apellido',
  segundo_apellido: 'Segundo apellido',
  nombre_completo: 'Nombre completo',
  fecha_nacimiento: 'Fecha de nacimiento',
  lugar_nacimiento: 'Lugar de nacimiento',
  estado_civil: 'Estado civil',
  codigo_postal: 'Código postal',
  es_civil: 'Personal civil',
  // Relación laboral
  relacion_laboral: 'Relación laboral',
  tipo_funcionario: 'Tipo de funcionario',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de fin',
  sub_unidad: 'Sub-unidad',
  prima_tecnica: 'Prima técnica',
  tiene_mando: 'Tiene mando',
  observaciones_laborales: 'Observaciones laborales',
  // Familiares
  familiares: 'Familiares',
  tipo_relacion: 'Tipo de relación',
  // Usuarios, roles, invitaciones y auth
  username: 'Usuario',
  rol_id: 'Rol',
  permiso_id: 'Permiso',
  via_invitacion: 'Alta por invitación',
  viaInvitacion: 'Alta por invitación',
  invitacion_id: 'Invitación',
  invitacionId: 'Invitación',
  persona_id: 'Persona',
  // Cursos, misiones e historial
  numero_orden: 'Número de orden',
  es_obligatorio: 'Obligatorio',
  nombre_mision: 'Nombre de la misión',
  mision_id: 'Misión',
  fecha_ascenso: 'Fecha de ascenso',
  motivo_baja: 'Motivo de baja',
  // Carga masiva
  fila: 'Fila',
  resultados: 'Resultados',
};

/** Valor con el que el backend reemplaza los campos sensibles. */
const MASCARA = '***';
const VACIO = '—';

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Convierte el detalle en secciones. Devuelve `[]` cuando no hay nada legible
 * que mostrar: en ese caso la vista cae al JSON crudo.
 */
export function formatearDetalle(detalle: unknown): SeccionDetalle[] {
  if (!esObjetoPlano(detalle)) return [];

  const secciones: SeccionDetalle[] = [];
  const sueltos: Record<string, unknown> = {};
  let params: Record<string, unknown> | null = null;

  for (const [clave, valor] of Object.entries(detalle)) {
    if (clave === 'params' && esObjetoPlano(valor)) {
      params = valor;
      continue;
    }
    const titulo = TITULOS_RAIZ[clave];
    const contenido = clave === 'resultado' ? desenvolver(valor) : valor;
    if (titulo && esObjetoPlano(contenido)) {
      const seccion = construirSeccion(titulo, contenido);
      if (tieneContenido(seccion)) secciones.push(seccion);
    } else {
      sueltos[clave] = valor;
    }
  }

  if (Object.keys(sueltos).length > 0) {
    const seccion = construirSeccion(secciones.length > 0 ? 'Otros datos' : null, sueltos);
    if (tieneContenido(seccion)) secciones.push(seccion);
  }

  // `params` suele ser solo el id del registro, que la tabla ya muestra en la
  // columna Entidad: repetirlo es ruido. La excepción son las bajas, donde es
  // lo único que hay y omitirlo dejaría el modal cayendo al JSON crudo.
  if (params) {
    const soloId = Object.keys(params).length === 1 && 'id' in params;
    if (!soloId || secciones.length === 0) {
      const seccion = construirSeccion(secciones.length > 0 ? 'Parámetros' : null, params);
      if (tieneContenido(seccion)) secciones.unshift(seccion);
    }
  }

  return secciones;
}

function tieneContenido(seccion: SeccionDetalle): boolean {
  return seccion.campos.length > 0 || seccion.subsecciones.length > 0;
}

/**
 * Los eventos guardados antes del arreglo del backend traen el resultado dentro
 * del sobre `{ service_response: { service_status, service_data } }` que agrega
 * el interceptor HTTP global. Se saca acá también para que esas filas viejas se
 * vean igual de limpias que las nuevas.
 */
function desenvolver(valor: unknown): unknown {
  if (!esObjetoPlano(valor)) return valor;
  const sobre = valor['service_response'];
  if (esObjetoPlano(sobre) && esObjetoPlano(sobre['service_data'])) {
    return sobre['service_data'];
  }
  return valor;
}

function construirSeccion(titulo: string | null, objeto: Record<string, unknown>): SeccionDetalle {
  const campos: CampoDetalle[] = [];
  const subsecciones: SeccionDetalle[] = [];

  for (const [clave, valor] of Object.entries(objeto)) {
    if (esIdRedundante(clave, objeto)) continue;

    if (Array.isArray(valor)) {
      subsecciones.push(...seccionesDeLista(etiquetaDe(clave), valor));
      continue;
    }

    if (esObjetoPlano(valor)) {
      const anidada = construirSeccion(etiquetaDe(clave), valor);
      if (anidada.campos.length > 0 || anidada.subsecciones.length > 0) subsecciones.push(anidada);
      continue;
    }

    campos.push({ etiqueta: etiquetaDe(clave), valor: formatearValor(valor) });
  }

  return { titulo, campos, subsecciones };
}

/** Una lista se abre en una subsección por elemento, numerada. */
function seccionesDeLista(etiqueta: string, lista: unknown[]): SeccionDetalle[] {
  if (lista.length === 0) {
    return [{ titulo: etiqueta, campos: [{ etiqueta: 'Sin elementos', valor: VACIO }], subsecciones: [] }];
  }

  // Lista de valores simples: una sola línea separada por comas.
  if (lista.every((item) => !esObjetoPlano(item) && !Array.isArray(item))) {
    return [{
      titulo: null,
      campos: [{ etiqueta, valor: lista.map(formatearValor).join(', ') }],
      subsecciones: [],
    }];
  }

  return lista.map((item, i) => {
    const titulo = `${etiqueta} ${i + 1}`;
    return esObjetoPlano(item)
      ? construirSeccion(titulo, item)
      : { titulo, campos: [{ etiqueta, valor: formatearValor(item) }], subsecciones: [] };
  });
}

/**
 * Descarta `grado_id` cuando al lado viene `grado` ya resuelto por nombre.
 * Si no hay hermano resuelto el id se muestra igual: es feo, pero es el dato
 * que quedó registrado y ocultarlo sería peor.
 */
function esIdRedundante(clave: string, objeto: Record<string, unknown>): boolean {
  if (!clave.endsWith('_id')) return false;
  return clave.slice(0, -3) in objeto;
}

export function etiquetaDe(clave: string): string {
  return ETIQUETAS[clave] ?? etiquetaPorDefecto(clave);
}

/**
 * `sub_unidad_id` → "Sub unidad (id)", `primer_nombre` → "Primer nombre",
 * `rolId` → "Rol id". Cubre snake_case y camelCase porque en la bitácora
 * conviven las dos convenciones.
 */
function etiquetaPorDefecto(clave: string): string {
  const esId = clave.endsWith('_id');
  const base = (esId ? clave.slice(0, -3) : clave)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  const texto = base.charAt(0).toUpperCase() + base.slice(1);
  return esId ? `${texto} (id)` : texto;
}

export function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return VACIO;
  if (valor === MASCARA) return '(oculto)';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'string') return formatearTexto(valor);
  return String(valor);
}

function formatearTexto(texto: string): string {
  if (SOLO_FECHA.test(texto)) return invertirFecha(texto);
  if (FECHA_HORA.test(texto)) {
    const fecha = new Date(texto);
    if (!Number.isNaN(fecha.getTime())) {
      // En UTC a propósito: las columnas `date` de la base (fecha de nacimiento,
      // fecha de inicio) se serializan como medianoche UTC, y leerlas en hora
      // local las correría un día para atrás en Uruguay.
      const hora = `${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())}`;
      const dia = `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`;
      // Si es medianoche era una fecha pura: mostrar "00:00" confunde.
      return hora === '00:00' ? dia : `${dia} ${hora}`;
    }
  }
  return texto;
}

function invertirFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

function dos(n: number): string {
  return String(n).padStart(2, '0');
}

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
