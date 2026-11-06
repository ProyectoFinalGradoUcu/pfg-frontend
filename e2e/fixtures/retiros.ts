import { APIRequestContext, expect } from '@playwright/test';
import { crearSubalternoEnBase } from './personal';

type Envoltorio<T> = { service_response: { service_data: T } };

/**
 * Deja un retiro anulado propio del test: da de alta un subalterno, lo retira y anula
 * el retiro. Así el listado de anulados no depende de lo que traiga la demo.
 */
export async function crearRetiroAnulado(api: APIRequestContext): Promise<{ cedula: string }> {
  const { id, cedula } = await crearSubalternoEnBase(api, 'E.T.A.', 'Retiro Anulado');

  const motivos = await api.get('/api/catalogos/motivos-baja');
  expect(motivos.ok(), `motivos-baja respondió ${motivos.status()}`).toBeTruthy();
  const [motivo] = ((await motivos.json()) as Envoltorio<{ id: number }[]>).service_response.service_data;

  // Ayer y no hoy: de noche "hoy" en UTC ya es mañana en Uruguay y el retiro sería futuro.
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const alta = await api.post('/api/retiros', {
    data: {
      service_request: { persona_id: Number(id), fecha_retiro: ayer, motivo_baja_id: Number(motivo.id) },
    },
  });
  expect(alta.ok(), `retiro respondió ${alta.status()}: ${await alta.text()}`).toBeTruthy();
  const retiroId = ((await alta.json()) as Envoltorio<{ id: number }>).service_response.service_data.id;

  const anulacion = await api.delete(`/api/retiros/${retiroId}`, {
    data: { service_request: { motivo_anulacion: 'Cargado para el test de anulados' } },
  });
  expect(anulacion.ok(), `anular respondió ${anulacion.status()}: ${await anulacion.text()}`).toBeTruthy();

  return { cedula };
}
