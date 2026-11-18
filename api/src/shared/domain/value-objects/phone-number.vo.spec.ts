import { ValidationError } from '../errors/domain.error';
import { PhoneNumber } from './phone-number.vo';

describe('PhoneNumber', () => {
  it('acepta un celular colombiano', () => {
    expect(PhoneNumber.create('+57', '3015551234').toE164()).toBe('+573015551234');
  });

  it('acepta un número de Estados Unidos', () => {
    expect(PhoneNumber.create('+1', '3015551234').toE164()).toBe('+13015551234');
  });

  it('limpia espacios, paréntesis y guiones', () => {
    expect(PhoneNumber.create('+1', '(301) 555-1234').nationalNumber).toBe('3015551234');
    expect(PhoneNumber.create('+34', '612 345 678').nationalNumber).toBe('612345678');
  });

  it('format() separa el prefijo del número', () => {
    expect(PhoneNumber.create('+57', '3015551234').format()).toBe('+57 3015551234');
  });

  it('rechaza prefijos mal formados', () => {
    expect(() => PhoneNumber.create('57', '3015551234')).toThrow(ValidationError);
    expect(() => PhoneNumber.create('+0', '3015551234')).toThrow(ValidationError);
    expect(() => PhoneNumber.create('+12345', '3015551234')).toThrow(ValidationError);
    expect(() => PhoneNumber.create('', '3015551234')).toThrow(ValidationError);
  });

  it('rechaza números vacíos o demasiado cortos', () => {
    expect(() => PhoneNumber.create('+57', '')).toThrow(ValidationError);
    expect(() => PhoneNumber.create('+57', 'abc')).toThrow(ValidationError);
    expect(() => PhoneNumber.create('+57', '123456')).toThrow(ValidationError);
  });

  it('rechaza números que pasan de 15 dígitos con el prefijo', () => {
    expect(() => PhoneNumber.create('+57', '123456789012345')).toThrow(ValidationError);
    // 2 (prefijo +57) + 13 = 15: justo en el límite, sí se acepta.
    expect(() => PhoneNumber.create('+57', '1234567890123')).not.toThrow();
  });

  it('rechaza números con todos los dígitos iguales', () => {
    expect(() => PhoneNumber.create('+57', '0000000000')).toThrow(ValidationError);
    expect(() => PhoneNumber.create('+1', '1111111111')).toThrow(ValidationError);
  });

  it('equals() compara prefijo y número', () => {
    const a = PhoneNumber.create('+57', '3015551234');
    expect(a.equals(PhoneNumber.create('+57', '301 555 1234'))).toBe(true);
    expect(a.equals(PhoneNumber.create('+1', '3015551234'))).toBe(false);
  });
});
