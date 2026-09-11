import { Retiro } from '../../core/models/retiros.models';
import { estadoRetiro, nombreFuncionario } from './retiro-presentacion';

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

describe('nombreFuncionario', () => {
  it('arma el nombre de la persona, no el grado', () => {
    expect(nombreFuncionario(retiro())).toBe('Ana Pereyra');
  });

  it('no depende del grado: el grado es un dato aparte del retiro', () => {
    expect(nombreFuncionario(retiro({ grado: null }))).toBe('Ana Pereyra');
  });
});
