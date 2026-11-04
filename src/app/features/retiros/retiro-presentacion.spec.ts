import { Retiro } from '../../core/models/retiros.models';
import { estadoRetiro, motivoNoAnulable, nombreFuncionario } from './retiro-presentacion';

function retiro(overrides: Partial<Retiro> = {}): Retiro {
  return {
    id: '7',
    persona: { id: '1', cedula: '60000001', primer_nombre: 'Ana', primer_apellido: 'Pereyra' },
    grado: { id: '14', denominacion: 'Coronel' },
    unidad: null,
    fecha_retiro: '2026-08-28',
    hora_retiro: null,
    motivo_baja: { codigo: 'RETIRO_VOL', denominacion: 'Baja por retiro voluntario.' },
    motivo: null,
    anulado: false,
    vigente: true,
    ...overrides,
  };
}

describe('estadoRetiro', () => {
  it('vigente cuando vigente es true', () => {
    expect(estadoRetiro(retiro())).toBe('vigente');
  });

  it('revertido cuando no está anulado pero ya no rige: se retiró y volvió', () => {
    expect(estadoRetiro(retiro({ anulado: false, vigente: false }))).toBe('revertido');
  });

  it('anulado gana sobre todo lo demás', () => {
    expect(estadoRetiro(retiro({ anulado: true, vigente: false }))).toBe('anulado');
  });
});

describe('motivoNoAnulable', () => {
  const movimiento = { id: '8', tipo: 'Retiro', fecha: '2026-08-28' };

  it('un retiro registrado desde el módulo y sin relación activa se puede anular', () => {
    expect(motivoNoAnulable({ ...retiro(), movimiento })).toBeNull();
  });

  it('sin movimiento es importado o histórico', () => {
    expect(motivoNoAnulable({ ...retiro(), movimiento: null })).toContain('histórico o importado');
  });

  it('el motivo FALLECIMIENTO no lo bloquea: el backend mira la fecha de la persona', () => {
    const r = { ...retiro({ motivo_baja: { codigo: 'FALLECIMIENTO', denominacion: 'Fallecimiento.' } }), movimiento };
    expect(motivoNoAnulable(r)).toBeNull();
  });

  it('si volvió al servicio después del retiro no se anula', () => {
    expect(motivoNoAnulable({ ...retiro({ vigente: false }), movimiento })).toBe(
      'El funcionario volvió al servicio después de este retiro.',
    );
  });
});

describe('nombreFuncionario', () => {
  it('arma el nombre de la persona, no el grado', () => {
    expect(nombreFuncionario(retiro())).toBe('Ana Pereyra');
  });

  it('no depende del grado: el grado es un dato aparte del retiro', () => {
    expect(nombreFuncionario(retiro({ grado: null }))).toBe('Ana Pereyra');
  });
});
