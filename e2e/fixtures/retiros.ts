import { APIRequestContext, expect } from '@playwright/test';
import { crearSubalternoEnBase } from './personal';

type Envoltorio<T> = { service_response: { service_data: T } };

async function datos<T>(res: { ok(): boolean; status(): number; text(): Promise<string>; json(): Promise<unknown> }, que: string): Promise<T> {
  expect(res.ok(), `${que} respondió ${res.status()}: ${await res.text()}`).toBeTruthy();
  return ((await res.json()) as Envoltorio<T>).service_response.service_data;
}

// Fecha de hace `dias` días; nunca hoy, porque de noche en UTC ya es mañana.
export function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
}

// Alta de un subalterno en E.T.A. y retiro voluntario hace 30 días.
export async function crearRetiro(
  api: APIRequestContext,
  apellido = 'Retiro E2E',
): Promise<{ retiroId: number; personaId: string; cedula: string }> {
  const { id, cedula } = await crearSubalternoEnBase(api, 'E.T.A.', apellido);

  const motivos = await datos<{ id: number; codigo: string }[]>(await api.get('/api/catalogos/motivos-baja'), 'motivos-baja');
  const motivo = motivos.find((m) => m.codigo === 'RETIRO_VOL')!;

  const alta = await api.post('/api/retiros', {
    data: {
      service_request: { persona_id: Number(id), fecha_retiro: haceDias(30), motivo_baja_id: Number(motivo.id) },
    },
  });
  const { id: retiroId } = await datos<{ id: number }>(alta, 'retiro');
  return { retiroId: Number(retiroId), personaId: id, cedula };
}

// Reincorpora ayer con el grado y la base que propone la previa.
export async function reincorporar(api: APIRequestContext, retiroId: number): Promise<void> {
  const previa = await datos<{
    se_copia: { grado: { id: number } | null };
    sub_unidad_anterior: { id: number } | null;
  }>(await api.get(`/api/retiros/${retiroId}/reincorporacion/previa`), 'previa de reincorporación');

  const res = await api.post(`/api/retiros/${retiroId}/reincorporacion`, {
    data: {
      service_request: {
        fecha_reincorporacion: haceDias(1),
        grado_reincorporacion_id: Number(previa.se_copia.grado!.id),
        sub_unidad_id: Number(previa.sub_unidad_anterior!.id),
        numero_orden: 'O.D. reincorporación e2e',
      },
    },
  });
  await datos(res, 'reincorporación');
}

/**
 * Deja un retiro anulado propio del test: da de alta un subalterno, lo retira y anula
 * el retiro. Así el listado de anulados no depende de lo que traiga la demo.
 */
export async function crearRetiroAnulado(api: APIRequestContext): Promise<{ cedula: string }> {
  const { retiroId, cedula } = await crearRetiro(api, 'Retiro Anulado');

  const anulacion = await api.delete(`/api/retiros/${retiroId}`, {
    data: { service_request: { motivo_anulacion: 'Cargado para el test de anulados' } },
  });
  expect(anulacion.ok(), `anular respondió ${anulacion.status()}: ${await anulacion.text()}`).toBeTruthy();

  return { cedula };
}
