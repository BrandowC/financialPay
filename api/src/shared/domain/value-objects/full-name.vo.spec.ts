import { ValidationError } from '../errors/domain.error';
import { FullName } from './full-name.vo';

describe('FullName', () => {
  it('colapsa espacios múltiples y recorta extremos', () => {
    expect(FullName.create('  Juan   Pérez  ').value).toBe('Juan Pérez');
  });

  it('acepta apóstrofos y guiones (O\'Brien, Jean-Luc)', () => {
    expect(() => FullName.create("Conor O'Brien")).not.toThrow();
    expect(() => FullName.create('Jean-Luc Picard')).not.toThrow();
  });

  it('rechaza dígitos y símbolos', () => {
    expect(() => FullName.create('Juan123')).toThrow(ValidationError);
    expect(() => FullName.create('Juan <script>')).toThrow(ValidationError);
  });

  it('rechaza nombres de un solo carácter', () => {
    expect(() => FullName.create('J')).toThrow(ValidationError);
  });

  it('rechaza vacío', () => {
    expect(() => FullName.create('')).toThrow(ValidationError);
    expect(() => FullName.create('   ')).toThrow(ValidationError);
  });

  describe('normalize', () => {
    it('quita tildes y pasa a minúsculas', () => {
      expect(FullName.normalize('José Núñez')).toBe('jose nunez');
    });

    it('dos escrituras del mismo nombre normalizan igual (soluciona el bug de homónimos)', () => {
      const a = FullName.create('María José Pérez');
      const b = FullName.create('maria jose perez');
      expect(a.equals(b)).toBe(true);
    });

    it('colapsa espacios también en la normalización', () => {
      expect(FullName.normalize('  Ana   López ')).toBe('ana lopez');
    });
  });

  describe('derivados', () => {
    it('firstName toma la primera palabra', () => {
      expect(FullName.create('María José Pérez').firstName).toBe('María');
    });

    it('initials toma las dos primeras iniciales en mayúscula', () => {
      expect(FullName.create('maría josé pérez gómez').initials).toBe('MJ');
    });
  });
});
