import { APIRequestContext, expect } from '@playwright/test';
import { cedulaUnica, idPorCedula } from './personal';
import { datos } from './usuarios';

type Item = { id: number | string; denominacion: string };

export type Inscripcion = {
  id: string;
  persona: { id: string; cedula: string };
  curso: { id: string; nombre_curso: string };
  aprobado: boolean | null;
  calificacion: number | null;
  observacion: string | null;
  dado_de_baja: boolean;
  motivo_baja: string | null;
};

export type Curso = {
  id: string;
  nombre_curso: string;
  institucion: string;
  es_obligatorio: boolean;
  modulos_curso: { nombre_modulo: string; orden_modulo: number }[];
};

async function leer<T>(api: APIRequestContext, url: string): Promise<T> {
  const res = await api.get(url);
  expect(res.ok(), `GET ${url} respondió ${res.status()}`).toBeTruthy();
  return datos<T>(res);
}

// Sgto. 1° de S.T.: un Sgto. nuevo cae fuera de las 100 personas que carga el selector.
export async function crearAlumno(
  api: APIRequestContext,
  apellido: string,
  base = 'E.T.A.',
): Promise<{ id: string; cedula: string; nombre: string }> {
  const [bases, escalafones, situaciones, regimenes, programas] = await Promise.all([
    leer<Item[]>(api, '/api/catalogos/sub-unidades'),
    leer<Item[]>(api, '/api/catalogos/escalafones'),
    leer<Item[]>(api, '/api/catalogos/situaciones'),
    leer<Item[]>(api, '/api/catalogos/regimenes'),
    leer<Item[]>(api, '/api/catalogos/programas'),
  ]);
  const escalafon = escalafones.find((e) => e.denominacion === '(S.T.)')!;
  const grados = await leer<Item[]>(api, `/api/catalogos/grados?escalafon_id=${escalafon.id}`);

  const cedula = cedulaUnica();
  const res = await api.post('/api/personas', {
    data: {
      cedula,
      primer_nombre: 'Test',
      primer_apellido: apellido,
      es_civil: false,
      tipo_funcionario: 'subalterno',
      regimen_id: Number(regimenes[0].id),
      programa_id: Number(programas[0].id),
      escalafon_id: Number(escalafon.id),
      grado_id: Number(grados.find((g) => g.denominacion === 'Sgto. 1°')!.id),
      situacion_id: Number(situaciones.find((s) => s.denominacion === 'Personal Subalterno en actividad.')!.id),
      sub_unidad_id: Number(bases.find((b) => b.denominacion === base)!.id),
      fecha_inicio: '2020-03-01',
      tiene_mando: false,
    },
  });
  expect(res.ok(), `alta de ${cedula} respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  return { id: await idPorCedula(api, cedula), cedula, nombre: `Test ${apellido}` };
}

export async function cursoPorNombre(api: APIRequestContext, nombre: string): Promise<Curso | undefined> {
  const r = await leer<{ items: Curso[] }>(api, `/api/cursos?nombre=${encodeURIComponent(nombre)}&pageSize=50`);
  return r.items.find((c) => c.nombre_curso === nombre);
}

export async function inscripcionesDe(api: APIRequestContext, cedula: string): Promise<Inscripcion[]> {
  const r = await leer<{ items: Inscripcion[] }>(
    api,
    `/api/cursos/funcionarios?cedula=${cedula}&incluir_bajas=true&pageSize=100`,
  );
  return r.items;
}

export async function borrarCursoSiExiste(api: APIRequestContext, nombre: string): Promise<void> {
  const curso = await cursoPorNombre(api, nombre);
  if (curso) await api.delete(`/api/cursos/${curso.id}`);
}
