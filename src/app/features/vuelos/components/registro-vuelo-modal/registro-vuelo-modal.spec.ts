import { parseHoras } from './registro-vuelo-modal';

describe('parseHoras', () => {
  it('vacío es cero', () => {
    expect(parseHoras('')).toBe(0);
    expect(parseHoras('  ')).toBe(0);
    expect(parseHoras(null)).toBe(0);
  });

  it('acepta coma decimal como en la planilla', () => {
    expect(parseHoras('221,9')).toBe(221.9);
    expect(parseHoras('1531')).toBe(1531);
    expect(parseHoras(4.8)).toBe(4.8);
  });

  it('lo que no es número da NaN', () => {
    expect(parseHoras('abc')).toBeNaN();
  });
});
