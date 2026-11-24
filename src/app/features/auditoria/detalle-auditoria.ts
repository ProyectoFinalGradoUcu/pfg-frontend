// Traduce un evento de auditoría a texto legible

import { AuditoriaRegistro } from '../../core/models/auditoria.models';

export interface CampoDetalle {
  etiqueta: string;
  valor: string;
}

export interface SeccionDetalle {
  titulo: string | null;
  campos: CampoDetalle[];
  subsecciones: SeccionDetalle[];
}

export interface OpcionesDetalle {
  nombres?: Record<string, string> | null;
  accion?: string | null;
  entidad?: string | null;
}

const ACCIONES: Record<string, string> = {
  CREAR: 'Creó',
  ACTUALIZAR: 'Modificó',
  ELIMINAR: 'Eliminó',
  ASIGNAR: 'Asignó',
  DESASIGNAR: 'Quitó',
  LOGIN: 'Ingresó al sistema',
  LOGOUT: 'Salió del sistema',
  LOGIN_FALLIDO: 'Intento de ingreso fallido',
  CAMBIAR_PASSWORD: 'Cambió su contraseña',
  RESETEAR_PASSWORD: 'Restableció la contraseña',
  DESCARGAR: 'Descargó',
  'ascenso.registrar': 'Registró un ascenso',
  'ascenso.anular': 'Anuló un ascenso',
  'orden_ascenso.anular': 'Anuló una orden de ascenso',
  'retiro.anular': 'Anuló un retiro',
  'reincorporacion.anular': 'Anuló una reincorporación',
  'derecha.reordenar': 'Reordenó la derecha',
  'derecha.cambios': 'Aplicó cambios en la derecha',
  'numor.reordenar': 'Reordenó el numor',
  'unidad.asignar': 'Asignó una unidad al usuario',
  'unidad.quitar': 'Quitó una unidad al usuario',
  'unidad_rol.agregar': 'Agregó un rol a la unidad',
  'unidad_rol.quitar': 'Quitó un rol de la unidad',
  'regla_ascenso.desactivar': 'Desactivó una regla de ascenso',
  'regla_ascenso.restaurar': 'Restauró una regla de ascenso',
  'relacion_laboral.cambio_unidad': 'Cambió de unidad a un funcionario',
  'reportes.ejecutar': 'Ejecutó un reporte',
  'auditoria.ver': 'Consultó la auditoría',
};

// Algunos módulos auditan con el nombre de la tabla en vez del de la entidad.
const ENTIDADES: Record<string, string> = {
  personas: 'Persona',
  destinos: 'Destino',
  misiones: 'Misión',
  retiros: 'Retiro',
  convocatorias: 'Convocatoria',
  ascensos_ordenes: 'Orden de ascenso',
  funcionarios_convocatorias: 'Convocatoria de funcionario',
  funcionarios_cursos: 'Historial de curso',
};

// Acciones que dan de alta algo
const ALTAS = new Set(['CREAR', 'ASIGNAR', 'ascenso.registrar']);

// Fotos de un registro, sin campos vacíos
const TITULOS_SIN_VACIOS = new Set(['Datos enviados', 'Registro creado', 'Registro eliminado', 'Datos antes de anular']);

// Claves de primer nivel que se muestran aparte o en el encabezado.
const CLAVES_ESPECIALES = new Set(['descripcion', 'cambios', 'anterior', 'params']);

// Datos internos que no le dicen nada al usuario.
const CLAVES_TECNICAS = new Set([
  'page', 'page_size', 'pageSize', 'es_por_defecto', 'importada', 'texto_original', 'futura',
  'version', 'versiones_anteriores',
]);

// Claves con las que un objeto se reconoce por su nombre.
const CLAVES_NOMBRE = ['denominacion', 'nombre_completo', 'nombre', 'username', 'etiqueta'];

// Lo que no esté acá cae en `etiquetaPorDefecto`.
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
  observacion: 'Observación',
  situacion: 'Situación',
  situacion_anterior: 'Situación anterior',
  regimen: 'Régimen',
  escalafon: 'Escalafón',
  numero: 'Número',
  codigo: 'Código',
  email: 'Correo',
  motivo: 'Motivo',
  categoria: 'Categoría',
  institucion: 'Institución',
  posicion: 'Posición',
  antes: 'Antes',
  despues: 'Después',
  notas: 'Notas',
  items: 'Elementos',
  password: 'Contraseña',
  cambio: 'Cambio de situación',
  vigente_desde: 'Vigente desde',
  vigente_hasta: 'Vigente hasta',
  creada_en: 'Creada el',
  creado_en: 'Creado el',
  actualizado_en: 'Actualizado el',
  actualizado_por: 'Actualizado por',
  anulada_en: 'Anulada el',
  anulado_en: 'Anulado el',
  anulada_por: 'Anulada por',
  anulado_por: 'Anulado por',
  fecha_baja: 'Fecha de baja',
  dado_de_baja: 'Dado de baja',
  dado_de_baja_por: 'Dado de baja por',
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
  credencial_civica: 'Credencial cívica',
  nivel_educativo: 'Nivel educativo',
  pais: 'País',
  fecha_fallecimiento: 'Fecha de fallecimiento',
  codigos_legajo: 'Códigos de legajo',
  mutaciones: 'Mutación de escalafón',
  fecha_ingreso_eta: 'Fecha de ingreso a la E.T.A.',
  fecha_egreso_eta: 'Fecha de egreso de la E.T.A.',
  numero_orden_egreso_eta: 'Número de orden de egreso de la E.T.A.',
  // Relación laboral
  relacion_laboral: 'Relación laboral',
  relacion_anterior: 'Relación anterior',
  relacion_nueva: 'Relación nueva',
  tipo_funcionario: 'Tipo de funcionario',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de fin',
  fechaInicio: 'Fecha de inicio',
  fechaFin: 'Fecha de fin',
  fecha_fin_anterior: 'Fecha de fin anterior',
  sub_unidad: 'Sub-unidad',
  sub_unidad_id: 'Sub-unidad',
  prima_tecnica: 'Prima técnica',
  tiene_mando: 'Tiene mando',
  observaciones_laborales: 'Observaciones laborales',
  posicion_derecha: 'Posición en la derecha',
  posicion_numor: 'Posición en el numor',
  posicion_destino: 'Posición del destino',
  numero_destino: 'Número de destino',
  // Familiares
  familiares: 'Familiares',
  tipo_relacion: 'Tipo de relación',
  // Usuarios, roles, invitaciones y auth
  username: 'Usuario',
  usuario: 'Usuario',
  usuarios: 'Usuarios',
  usuario_id: 'Usuario',
  usuarioId: 'Usuario',
  usuarioIds: 'Usuarios',
  rol: 'Rol',
  rol_id: 'Rol',
  rolId: 'Rol',
  roles: 'Roles',
  rolesAnteriores: 'Roles anteriores',
  rolesResultantes: 'Roles resultantes',
  permiso_id: 'Permiso',
  permisos: 'Permisos',
  via_invitacion: 'Alta por invitación',
  viaInvitacion: 'Alta por invitación',
  invitacion_id: 'Invitación',
  invitacionId: 'Invitación',
  persona_id: 'Persona',
  personaId: 'Persona',
  persona_ids: 'Personas',
  intentos_fallidos: 'Intentos fallidos',
  // Unidades
  unidad: 'Unidad',
  unidad_id: 'Unidad',
  unidadIds: 'Unidades',
  unidadesAnteriores: 'Unidades anteriores',
  unidadesNuevas: 'Unidades nuevas',
  usuariosAfectados: 'Usuarios afectados',
  yaEstaban: 'Ya estaban',
  noEncontrados: 'No encontrados',
  asignados: 'Asignados',
  comando: 'Comando',
  // Cursos, misiones, comisiones e historial
  numero_orden: 'Número de orden',
  es_obligatorio: 'Obligatorio',
  nombre_mision: 'Nombre de la misión',
  mision: 'Misión',
  resolucion_cje: 'Resolución CJE',
  modulos: 'Módulos',
  orden_modulo: 'Orden del módulo',
  total_integrantes: 'Total de integrantes',
  total_bases: 'Total de bases',
  // Vuelos
  periodo: 'Período',
  etiqueta: 'Período',
  anio: 'Año',
  unidad_vuelo: 'Unidad de vuelo',
  hs_av_anio_militar: 'Horas Av (año militar)',
  hs_av_total: 'Horas Av (total)',
  hs_ob_anio_militar: 'Horas Ob (año militar)',
  hs_ob_total: 'Horas Ob (total)',
  total_registros: 'Total de registros',
  mision_id: 'Misión',
  misionIds: 'Misiones',
  curso_id: 'Curso',
  cursos_ids: 'Cursos',
  modulo_ids: 'Módulos',
  nombre_curso: 'Nombre del curso',
  nombre_modulo: 'Nombre del módulo',
  nivel_idoneidad: 'Nivel de idoneidad',
  comision: 'Comisión',
  comision_id: 'Comisión',
  comisiones: 'Comisiones',
  designacion_ids: 'Designaciones',
  designacionId: 'Designación',
  funcionarios: 'Funcionarios',
  fecha_salida: 'Fecha de salida',
  fecha_llegada: 'Fecha de llegada',
  fecha_finalizacion: 'Fecha de finalización',
  // Ascensos, retiros y reincorporaciones
  fecha_ascenso: 'Fecha de ascenso',
  fecha_orden: 'Fecha de la orden',
  fecha_retiro: 'Fecha de retiro',
  fecha_reincorporacion: 'Fecha de reincorporación',
  fecha_ultimo_ascenso: 'Fecha del último ascenso',
  grado_origen_id: 'Grado de origen',
  grado_destino_id: 'Grado de destino',
  grado_reincorporacion_id: 'Grado de reincorporación',
  grado_anterior: 'Grado anterior',
  grado_nuevo: 'Grado nuevo',
  grado_actual: 'Grado actual',
  grado_origen: 'Grado de origen',
  grado_destino: 'Grado de destino',
  grado_reincorporacion: 'Grado de reincorporación',
  tipo_ascenso: 'Tipo de ascenso',
  por_excepcion: 'Por excepción',
  cumplia_requisitos: 'Cumplía los requisitos',
  fecha_cumpliria: 'Fecha en que cumpliría',
  antiguedad_dias: 'Antigüedad (días)',
  evaluacion: 'Evaluación',
  regla: 'Regla de ascenso',
  anios: 'Años',
  cantidad_funcionarios: 'Cantidad de funcionarios',
  cantidad_por_excepcion: 'Cantidad por excepción',
  hora_retiro: 'Hora de retiro',
  motivo_excepcion: 'Motivo de excepción',
  motivo_anulacion: 'Motivo de anulación',
  motivo_baja: 'Motivo de baja',
  haber_retiro: 'Haber de retiro',
  dias_minimos: 'Días mínimos',
  edad_maxima: 'Edad máxima',
  anios_servicio_anterior: 'Años de servicio anteriores',
  // La resolución se guarda en las columnas `boletin`: el nombre viejo no se muestra.
  boletin: 'Resolución',
  fecha_boletin: 'Fecha de resolución',
  numero_resolucion: 'Número de resolución',
  fecha_resolucion: 'Fecha de resolución',
  archivo_boletin_id: 'Archivo de la resolución',
  archivo_orden_id: 'Archivo de la orden',
  slot: 'Documento',
  // Archivos y quién los cargó
  nombre_original: 'Nombre del archivo',
  content_type: 'Tipo de archivo',
  tamanio_bytes: 'Tamaño',
  subido_por: 'Subido por',
  subido_en: 'Subido el',
  creada_por: 'Creada por',
  creado_por: 'Creado por',
  registrado_por: 'Registrado por',
  // Carga masiva y reportes
  fila: 'Fila',
  resultados: 'Resultados',
  filtros: 'Filtros',
  columnas: 'Columnas',
  desde: 'Desde',
  hasta: 'Hasta',
};

const TIPO_PERSONAL = { subalterno: 'Subalterno', oficial: 'Oficial', civil: 'Civil' };

/** Valores que se guardan con un código y se muestran con su nombre. */
const VALORES: Record<string, Record<string, string>> = {
  slot: { orden: 'Orden', boletin: 'Resolución' },
  tipo_funcionario: TIPO_PERSONAL,
  categoria: TIPO_PERSONAL,
  estado: {
    activo: 'Activo',
    inactivo: 'Inactivo',
    ok: 'Correcto',
    error: 'Con error',
    bloqueado: 'Bloqueado',
    PASIBLE: 'Pasible',
    PROXIMO: 'Próximo',
    BLOQUEADO: 'Bloqueado',
    FUERA_DE_EDAD: 'Fuera de edad',
    SIN_REGLA: 'Sin regla',
    TOPE_DE_ESCALA: 'Tope de escala',
    APROBADO: 'Aprobado',
    EN_CURSO: 'En curso',
    NO_APROBADO: 'No aprobado',
    DADO_DE_BAJA: 'Dado de baja',
    NO_REALIZADO: 'No realizado',
  },
  tipo: {
    optativo: 'Optativo',
    obligatorio: 'Obligatorio',
    ANTIGUEDAD: 'Antigüedad',
    ANTIGUEDAD_SERVICIO: 'Antigüedad de servicio',
    EDAD: 'Edad',
    CURSO_APROBADO: 'Curso aprobado',
  },
  tipo_ascenso: {
    SIGUIENTE: 'Al grado siguiente',
    SALTO: 'Salto de grado',
    CAMBIO_ESCALA: 'Cambio de escala',
    NO_SUPERIOR: 'A un grado no superior',
  },
  cambio: {
    LICENCIA_SIN_GOCE: 'Licencia sin goce de sueldo',
    NO_DISPONIBLE: 'No disponible',
    VOLVER_A_ACTIVIDAD: 'Vuelta a actividad',
  },
  prima_tecnica: { VACIO: '—' },
  nivel_educativo: {
    PRIMARIA: 'Primaria',
    CICLO_BASICO_INCOMPLETO: 'Ciclo básico incompleto',
    CICLO_BASICO: 'Ciclo básico',
    BACHILLERATO_INCOMPLETO: 'Bachillerato incompleto',
    BACHILLERATO: 'Bachillerato',
    BACHILLERATO_TECNOLOGICO: 'Bachillerato tecnológico (UTU)',
    TERCIARIO: 'Terciario',
  },
  fuente: { personal: 'Personal', misiones: 'Misiones', destinos: 'Destinos', ascensos: 'Ascensos' },
  genero: { F: 'Femenino', M: 'Masculino' },
  tipo_relacion: { HERMANO: 'Hermano/a' },
};

// Un código desconocido sale sin guiones bajos
const CLAVES_CODIGO = new Set(Object.keys(VALORES).filter((c) => c !== 'slot' && c !== 'genero'));

const PORCENTAJES = new Set(['porcentaje_progresivo']);
const MONTOS = new Set(['haber_retiro']);
const BYTES = new Set(['tamanio_bytes']);

/** Valor con el que el backend reemplaza los campos sensibles. */
const MASCARA = '***';
const VACIO = '—';

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const NUMERO = /^-?\d+(\.\d+)?$/;
const FORMATO_URUGUAY = new Intl.DateTimeFormat('es-UY', {
  timeZone: 'America/Montevideo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const FORMATO_MONTO = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FORMATO_DECIMAL = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 });
const FORMATO_UN_DECIMAL = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 });

export function textoAccion(accion: string | null | undefined): string {
  if (!accion) return VACIO;
  return ACCIONES[accion] ?? humanizar(accion);
}

export function textoEntidad(entidad: string | null | undefined): string | null {
  if (!entidad) return null;
  if (ENTIDADES[entidad]) return ENTIDADES[entidad];
  // Nombre de tabla suelto se humaniza
  return /^[a-z0-9_]+$/.test(entidad) ? humanizar(entidad) : entidad;
}

// Frase de la fila, si el backend no la manda se arma acá
export function resumenDe(
  registro: Pick<AuditoriaRegistro, 'accion' | 'entidad' | 'detalle'> &
    Partial<Pick<AuditoriaRegistro, 'resumen' | 'entidadNombre'>>,
): string {
  const resumen = registro.resumen?.trim();
  if (resumen) return resumen;
  const descripcion = esObjetoPlano(registro.detalle) ? registro.detalle['descripcion'] : null;
  if (typeof descripcion === 'string' && descripcion.trim()) return descripcion.trim();
  return [textoAccion(registro.accion), textoEntidad(registro.entidad), registro.entidadNombre?.trim()]
    .filter(Boolean)
    .join(' · ');
}

// Vacío si no hay nada legible
export function formatearDetalle(detalle: unknown, opciones: OpcionesDetalle = {}): SeccionDetalle[] {
  if (!esObjetoPlano(detalle)) return [];

  const ctx: Contexto = { nombres: opciones.nombres ?? {}, entidad: opciones.entidad ?? null, sinVacios: false };
  const secciones: SeccionDetalle[] = [];
  const sueltos: Record<string, unknown> = {};
  const agregar = (titulo: string | null, objeto: Record<string, unknown>) => {
    const seccion = construirSeccion(titulo, objeto, { ...ctx, sinVacios: TITULOS_SIN_VACIOS.has(titulo ?? '') });
    if (tieneContenido(seccion)) secciones.push(seccion);
  };

  const cambios = detalle['cambios'];
  const hayCambios = esListaDeCambios(cambios);
  if (hayCambios) {
    const seccion = seccionCambios(cambios);
    if (tieneContenido(seccion)) secciones.push(seccion);
  } else if (cambios !== undefined) {
    sueltos['cambios'] = cambios;
  }

  const anterior = detalle['anterior'];
  if (esObjetoPlano(anterior)) agregar(tituloAnterior(opciones.accion), anterior);

  const alta = ALTAS.has(opciones.accion ?? '');
  // En ediciones y bajas la respuesta repite los cambios
  const ocultarResultado = !alta && ((hayCambios && cambios.length > 0) || esObjetoPlano(anterior));

  for (const [clave, valor] of Object.entries(detalle)) {
    if (CLAVES_ESPECIALES.has(clave)) continue;
    if (clave === 'resultado' && ocultarResultado) continue;
    const titulo = clave === 'body' ? 'Datos enviados' : clave === 'resultado' ? (alta ? 'Registro creado' : 'Resultado') : null;
    const contenido = desenvolver(clave, valor);
    if (titulo && esObjetoPlano(contenido)) agregar(titulo, contenido);
    else sueltos[clave] = valor;
  }

  if (Object.keys(sueltos).length > 0) agregar(secciones.length > 0 ? 'Otros datos' : null, sueltos);

  // Params solo se muestra si no hay otra cosa
  const params = detalle['params'];
  if (secciones.length === 0 && esObjetoPlano(params)) agregar(null, params);

  return secciones;
}

interface Contexto {
  nombres: Record<string, string>;
  entidad: string | null;
  sinVacios: boolean;
}

interface Cambio {
  campo: string;
  etiqueta?: unknown;
  anterior: unknown;
  nuevo: unknown;
}

function esListaDeCambios(valor: unknown): valor is Cambio[] {
  return Array.isArray(valor) && valor.every((c) => esObjetoPlano(c) && typeof c['campo'] === 'string');
}

function seccionCambios(cambios: Cambio[]): SeccionDetalle {
  const campos: CampoDetalle[] = [];
  for (const c of cambios) {
    const etiqueta = typeof c.etiqueta === 'string' && c.etiqueta.trim() ? c.etiqueta.trim() : etiquetaDe(c.campo);
    // Eventos viejos con un objeto por persona, un renglón por dato
    if (esObjetoPlano(c.anterior) || esObjetoPlano(c.nuevo)) {
      const antes = esObjetoPlano(c.anterior) ? c.anterior : {};
      const despues = esObjetoPlano(c.nuevo) ? c.nuevo : {};
      for (const sub of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
        if (esClaveId(sub) || CLAVES_TECNICAS.has(sub)) continue;
        const valor = flecha(sub, antes[sub], despues[sub]);
        if (valor) campos.push({ etiqueta: `${etiquetaDe(sub)} de ${etiqueta}`, valor });
      }
      continue;
    }
    campos.push({ etiqueta, valor: `${valorLegible(c.campo, c.anterior)} → ${valorLegible(c.campo, c.nuevo)}` });
  }
  return { titulo: 'Cambios', campos: sinRepetidos(campos), subsecciones: [] };
}

// Null si el dato quedó igual.
function flecha(clave: string, anterior: unknown, nuevo: unknown): string | null {
  const antes = valorLegible(clave, anterior);
  const despues = valorLegible(clave, nuevo);
  return antes === despues ? null : `${antes} → ${despues}`;
}

function tituloAnterior(accion: string | null | undefined): string {
  if (accion === 'ELIMINAR') return 'Registro eliminado';
  if (accion?.endsWith('.anular')) return 'Datos antes de anular';
  return 'Datos anteriores';
}

function tieneContenido(seccion: SeccionDetalle): boolean {
  return seccion.campos.length > 0 || seccion.subsecciones.length > 0;
}

// Saca el sobre del interceptor en eventos viejos
function desenvolver(clave: string, valor: unknown): unknown {
  if (!esObjetoPlano(valor)) return valor;
  if (clave === 'body' && esObjetoPlano(valor['service_request'])) return valor['service_request'];
  if (clave === 'resultado') {
    const sobre = valor['service_response'];
    if (esObjetoPlano(sobre) && esObjetoPlano(sobre['service_data'])) return sobre['service_data'];
  }
  return valor;
}

function construirSeccion(titulo: string | null, objeto: Record<string, unknown>, ctx: Contexto): SeccionDetalle {
  const campos: CampoDetalle[] = [];
  const subsecciones: SeccionDetalle[] = [];
  const agregarCampo = (etiqueta: string, valor: string) => {
    if (ctx.sinVacios && valor === VACIO) return;
    campos.push({ etiqueta, valor });
  };

  for (const [clave, valor] of Object.entries(objeto)) {
    if (esClaveTecnica(clave, objeto) || esIdRedundante(clave, objeto)) continue;

    if (esClaveId(clave)) {
      const campo = campoDeId(clave, valor, ctx);
      if (campo) agregarCampo(campo.etiqueta, campo.valor);
      continue;
    }

    if (Array.isArray(valor)) {
      // Las listas simples van como un campo más
      if (valor.every((item) => !esObjetoPlano(item) && !Array.isArray(item))) {
        const texto = valor.length === 0 ? VACIO : valor.map((v) => valorLegible(clave, v)).join(', ');
        agregarCampo(etiquetaDe(clave), texto);
      } else {
        subsecciones.push(...seccionesDeLista(etiquetaDe(clave), valor, ctx));
      }
      continue;
    }

    if (esObjetoPlano(valor)) {
      const nombre = nombreDeReferencia(valor);
      if (nombre !== null) {
        agregarCampo(etiquetaDe(clave), nombre);
        continue;
      }
      const anidada = construirSeccion(etiquetaDe(clave), valor, ctx);
      if (tieneContenido(anidada)) subsecciones.push(anidada);
      continue;
    }

    agregarCampo(etiquetaDe(clave), valorLegible(clave, valor));
  }

  return { titulo, campos: sinRepetidos(campos), subsecciones };
}

// Etiquetas repetidas: si el valor es igual queda una, si no se numeran
function sinRepetidos(campos: CampoDetalle[]): CampoDetalle[] {
  const salida: CampoDetalle[] = [];
  const porEtiqueta = new Map<string, CampoDetalle[]>();
  for (const { etiqueta, valor } of campos) {
    const grupo = porEtiqueta.get(etiqueta);
    if (!grupo) {
      const nuevo = { etiqueta, valor };
      salida.push(nuevo);
      porEtiqueta.set(etiqueta, [nuevo]);
    } else if (valor === VACIO || grupo.some((c) => c.valor === valor)) {
      continue;
    } else if (grupo.length === 1 && grupo[0].valor === VACIO) {
      grupo[0].valor = valor;
    } else {
      const nuevo = { etiqueta: `${etiqueta} (${grupo.length + 1})`, valor };
      salida.push(nuevo);
      grupo.push(nuevo);
    }
  }
  return salida;
}

// Una lista de objetos se abre en una subsección por elemento, numerada.
function seccionesDeLista(etiqueta: string, lista: unknown[], ctx: Contexto): SeccionDetalle[] {
  return lista.map((item, i) => {
    const titulo = `${etiqueta} ${i + 1}`;
    return esObjetoPlano(item)
      ? construirSeccion(titulo, item, ctx)
      : { titulo, campos: [{ etiqueta, valor: formatearValor(item) }], subsecciones: [] };
  }).filter(tieneContenido);
}

function esClaveTecnica(clave: string, objeto: Record<string, unknown>): boolean {
  if (CLAVES_TECNICAS.has(clave)) return true;
  const tieneNombre = 'denominacion' in objeto || 'nombre' in objeto;
  if (clave === 'codigo') return tieneNombre;
  // El orden del grado es interno, el de una orden de ascenso no
  if (clave === 'orden') return tieneNombre || 'codigo' in objeto;
  if (clave === 'total') return 'page' in objeto || 'page_size' in objeto || 'pageSize' in objeto;
  return false;
}

// Un grado o usuario anidado se muestra por su nombre
function nombreDeReferencia(objeto: Record<string, unknown>): string | null {
  const claveNombre = CLAVES_NOMBRE.find((c) => typeof objeto[c] === 'string' && (objeto[c] as string).trim() !== '');
  if (!claveNombre) return null;
  const resto = Object.keys(objeto).filter((c) => c !== claveNombre && !esClaveId(c) && !esClaveTecnica(c, objeto));
  return resto.length === 0 ? (objeto[claveNombre] as string).trim() : null;
}

function esClaveId(clave: string): boolean {
  return clave === 'id' || /_ids?$/.test(clave) || /[a-z0-9]Ids?$/.test(clave);
}

function baseDeId(clave: string): string {
  return clave.replace(/(_ids?|Ids?)$/, '');
}

// Un id solo se muestra si viene con su nombre
function campoDeId(clave: string, valor: unknown, ctx: Contexto): CampoDetalle | null {
  const nombreDe = (v: unknown) =>
    typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint'
      ? ctx.nombres[`${clave}:${String(v)}`]
      : undefined;
  const nombres = (Array.isArray(valor) ? valor.map(nombreDe) : [nombreDe(valor)]).filter(
    (n): n is string => typeof n === 'string' && n.trim() !== '',
  );
  if (nombres.length === 0) return null;
  return { etiqueta: etiquetaDeId(clave, ctx), valor: nombres.join(', ') };
}

function etiquetaDeId(clave: string, ctx: Contexto): string {
  if (clave === 'id') return textoEntidad(ctx.entidad) ?? 'Registro';
  return ETIQUETAS[clave] ?? etiquetaDe(baseDeId(clave));
}

// Saca `grado_id` o `rolId` si al lado viene el nombre
function esIdRedundante(clave: string, objeto: Record<string, unknown>): boolean {
  if (clave === 'id' || !esClaveId(clave)) return false;
  return baseDeId(clave) in objeto;
}

// Lo que no parece una clave se deja tal cual
export function etiquetaDe(clave: string): string {
  if (ETIQUETAS[clave]) return ETIQUETAS[clave];
  return /^[A-Za-z0-9_.-]+$/.test(clave) ? humanizar(clave) : clave.trim();
}

function humanizar(texto: string): string {
  const base = texto
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function valorLegible(clave: string, valor: unknown): string {
  const traducido = VALORES[clave]?.[String(valor)];
  if (traducido) return traducido;
  if (typeof valor === 'string' && CLAVES_CODIGO.has(clave) && /^[A-Za-z]+(_[A-Za-z]+)+$/.test(valor)) {
    return humanizar(valor);
  }
  const numero = typeof valor === 'number' ? valor : typeof valor === 'string' && NUMERO.test(valor) ? Number(valor) : null;
  if (numero !== null && Number.isFinite(numero)) {
    if (PORCENTAJES.has(clave)) return `${FORMATO_DECIMAL.format(numero * 100)} %`;
    if (MONTOS.has(clave)) return FORMATO_MONTO.format(numero);
    if (BYTES.has(clave)) return tamanio(numero);
  }
  return formatearValor(valor);
}

function tamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${FORMATO_UN_DECIMAL.format(bytes / 1024)} KB`;
  return `${FORMATO_UN_DECIMAL.format(bytes / (1024 * 1024))} MB`;
}

export function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return VACIO;
  if (valor === MASCARA) return '(oculto)';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return String(valor);
  if (typeof valor === 'string') return formatearTexto(valor);
  if (Array.isArray(valor)) return valor.length === 0 ? VACIO : valor.map(formatearValor).join(', ');
  if (esObjetoPlano(valor)) return objetoEnLinea(valor);
  return String(valor);
}

// Un objeto se muestra como "Etiqueta: valor"
function objetoEnLinea(objeto: Record<string, unknown>): string {
  const nombre = nombreDeReferencia(objeto);
  if (nombre !== null) return nombre;
  const partes = Object.entries(objeto)
    .filter(([clave, valor]) => !esClaveId(clave) && !esClaveTecnica(clave, objeto) && valorLegible(clave, valor) !== VACIO)
    .map(([clave, valor]) => `${etiquetaDe(clave)}: ${valorLegible(clave, valor)}`);
  return partes.length === 0 ? VACIO : partes.join('; ');
}

function formatearTexto(texto: string): string {
  if (SOLO_FECHA.test(texto)) return invertirFecha(texto);
  if (FECHA_HORA.test(texto)) {
    const fecha = new Date(texto);
    if (!Number.isNaN(fecha.getTime())) {
      // Si es medianoche es una fecha sin hora
      if (fecha.getUTCHours() === 0 && fecha.getUTCMinutes() === 0 && fecha.getUTCSeconds() === 0) {
        return `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`;
      }
      return FORMATO_URUGUAY.format(fecha).replace(',', '');
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
