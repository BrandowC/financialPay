import { ValidationError } from '../errors/domain.error';
import { UsPhoneNumber } from './phone-number.vo';

describe('UsPhoneNumber', () => {
  it('acepta 10 dígitos limpios', () => {
    expect(UsPhoneNumber.create('3015551234').toE164()).toBe('+13015551234');
  });

  it('limpia formatos con paréntesis y guiones', () => {
    expect(UsPhoneNumber.create('(301) 555-1234').toE164()).toBe('+13015551234');
  });

  it('quita el prefijo +1 si el usuario lo escribió', () => {
    expect(UsPhoneNumber.create('+1 301 555 1234').toE164()).toBe('+13015551234');
    expect(UsPhoneNumber.create('13015551234').toE164()).toBe('+13015551234');
  });

  it('rechaza menos o más de 10 dígitos', () => {
    expect(() => UsPhoneNumber.create('301555123')).toThrow(ValidationError);
    expect(() => UsPhoneNumber.create('30155512345')).toThrow(ValidationError);
  });

  it('rechaza código de área que empieza en 0 o 1', () => {
    expect(() => UsPhoneNumber.create('0015551234')).toThrow(ValidationError);
    expect(() => UsPhoneNumber.create('1015551234')).toThrow(ValidationError);
  });

  it('rechaza códigos de servicio tipo N11 (911, 411…)', () => {
    expect(() => UsPhoneNumber.create('9115551234')).toThrow(ValidationError);
  });

  it('rechaza los números reservados para ficción 555-01XX', () => {
    expect(() => UsPhoneNumber.create('3015550199')).toThrow(ValidationError);
  });

  it('acepta otros números 555 que no sean el rango reservado', () => {
    expect(() => UsPhoneNumber.create('3015551234')).not.toThrow();
  });

  it('format() da el formato humano (301) 555-1234', () => {
    expect(UsPhoneNumber.create('3015551234').format()).toBe('(301) 555-1234');
  });

  it('rechaza vacío', () => {
    expect(() => UsPhoneNumber.create('')).toThrow(ValidationError);
  });
});
