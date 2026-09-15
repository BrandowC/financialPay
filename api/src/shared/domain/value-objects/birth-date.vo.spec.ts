import { ValidationError } from '../errors/domain.error';
import { BirthDate } from './birth-date.vo';

describe('BirthDate', () => {
  // Reloj fijo para que la prueba no dependa de en qué día se ejecute.
  const NOW = new Date('2026-06-15T12:00:00.000Z');

  it('acepta a alguien que ya cumplió 18 años', () => {
    const bd = BirthDate.create('2008-06-14', NOW); // cumplió ayer
    expect(bd.age(NOW)).toBe(18);
  });

  it('rechaza a alguien que cumple 18 justo mañana', () => {
    expect(() => BirthDate.create('2008-06-16', NOW)).toThrow(ValidationError);
  });

  it('acepta exactamente el día del cumpleaños número 18', () => {
    const bd = BirthDate.create('2008-06-15', NOW);
    expect(bd.age(NOW)).toBe(18);
  });

  it('calcula bien la edad cuando el cumpleaños todavía no llegó este año', () => {
    // Nació el 20 de diciembre; hoy es 15 de junio: el cumpleaños de este año
    // no ha llegado, así que debe restar uno.
    const bd = BirthDate.create('2000-12-20', NOW);
    expect(bd.age(NOW)).toBe(25);
  });

  it('rechaza una fecha en el futuro', () => {
    expect(() => BirthDate.create('2030-01-01', NOW)).toThrow(ValidationError);
  });

  it('rechaza una fecha que no existe (30 de febrero)', () => {
    expect(() => BirthDate.create('2020-02-30', NOW)).toThrow(ValidationError);
  });

  it('rechaza formatos que no sean AAAA-MM-DD', () => {
    expect(() => BirthDate.create('06/15/2000', NOW)).toThrow(ValidationError);
    expect(() => BirthDate.create('15-06-2000', NOW)).toThrow(ValidationError);
  });

  it('rechaza edades imposibles (más de 120 años)', () => {
    expect(() => BirthDate.create('1850-01-01', NOW)).toThrow(ValidationError);
  });

  it('calcula bien la edad en un año bisiesto', () => {
    const bd = BirthDate.create('2004-02-29', new Date('2026-03-01T00:00:00.000Z'));
    expect(bd.age(new Date('2026-03-01T00:00:00.000Z'))).toBe(22);
  });
});
