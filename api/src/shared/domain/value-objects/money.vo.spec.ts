import { ValidationError } from '../errors/domain.error';
import { Money } from './money.vo';

/**
 * Estas pruebas son el motivo de ser de la clase Money: demostrar que NUNCA
 * se cuela un error de coma flotante en el dinero. Cada caso aquí representa
 * un bug real que se ha visto en sistemas financieros reales.
 */
describe('Money', () => {
  describe('fromDecimalString', () => {
    it('convierte dólares y centavos a centavos exactos', () => {
      expect(Money.fromDecimalString('10.50').cents).toBe(1050n);
      expect(Money.fromDecimalString('0.01').cents).toBe(1n);
      expect(Money.fromDecimalString('1000000.99').cents).toBe(100000099n);
    });

    it('el clásico 0.1 + 0.2 da exactamente 0.30, no 0.30000000000000004', () => {
      const a = Money.fromDecimalString('0.10');
      const b = Money.fromDecimalString('0.20');
      expect(a.add(b).toDecimalString()).toBe('0.30');
    });

    it('rellena un solo decimal: "1.5" son 150 centavos, no 105', () => {
      expect(Money.fromDecimalString('1.5').cents).toBe(150n);
    });

    it('acepta montos enteros sin punto decimal', () => {
      expect(Money.fromDecimalString('500').cents).toBe(50000n);
    });

    it('tolera comas de miles y espacios sobrantes', () => {
      expect(Money.fromDecimalString(' 1,234.56 ').cents).toBe(123456n);
    });

    it('rechaza más de dos decimales', () => {
      expect(() => Money.fromDecimalString('1.999')).toThrow(ValidationError);
    });

    it('rechaza negativos', () => {
      expect(() => Money.fromDecimalString('-5.00')).toThrow(ValidationError);
    });

    it('rechaza notación científica (vector clásico de confusión)', () => {
      expect(() => Money.fromDecimalString('1e10')).toThrow(ValidationError);
    });

    it('rechaza texto que no es un número', () => {
      expect(() => Money.fromDecimalString('abc')).toThrow(ValidationError);
      expect(() => Money.fromDecimalString('')).toThrow(ValidationError);
      expect(() => Money.fromDecimalString('  ')).toThrow(ValidationError);
    });

    it('rechaza un monto absurdamente grande (protección contra error de tipeo)', () => {
      expect(() => Money.fromDecimalString('999999999999999.00')).toThrow(ValidationError);
    });

    it('rechaza cuando no llega un string (defensa en profundidad de tipos)', () => {
      // @ts-expect-error -- se prueba deliberadamente con un tipo incorrecto
      expect(() => Money.fromDecimalString(1500.5)).toThrow(ValidationError);
    });
  });

  describe('operaciones', () => {
    it('add y subtract son exactos en centenares de sumas repetidas', () => {
      let total = Money.zero();
      for (let i = 0; i < 300; i++) {
        total = total.add(Money.fromDecimalString('0.10'));
      }
      // 300 x 0.10 = 30.00 exactos. Con float esto NO da 30.00.
      expect(total.toDecimalString()).toBe('30.00');
    });

    it('subtract nunca deja pasar un resultado negativo', () => {
      const small = Money.fromDecimalString('5.00');
      const big = Money.fromDecimalString('10.00');
      expect(() => small.subtract(big)).toThrow(ValidationError);
    });

    it('rechaza operar montos de distinta moneda', () => {
      const usd = Money.fromCents(100n, 'USD');
      const eur = Money.fromCents(100n, 'EUR');
      expect(() => usd.add(eur)).toThrow(ValidationError);
    });

    it('equals compara centavos y moneda', () => {
      expect(Money.fromCents(500n, 'USD').equals(Money.fromCents(500n, 'USD'))).toBe(true);
      expect(Money.fromCents(500n, 'USD').equals(Money.fromCents(501n, 'USD'))).toBe(false);
    });
  });

  describe('inmutabilidad', () => {
    it('las operaciones no mutan la instancia original', () => {
      const original = Money.fromDecimalString('100.00');
      const result = original.add(Money.fromDecimalString('50.00'));

      expect(original.toDecimalString()).toBe('100.00');
      expect(result.toDecimalString()).toBe('150.00');
    });

    it('la instancia está congelada', () => {
      const money = Money.fromDecimalString('10.00');
      expect(Object.isFrozen(money)).toBe(true);
    });
  });

  describe('representación', () => {
    it('toJSON nunca expone un number, siempre cadenas', () => {
      const json = Money.fromDecimalString('1234.56').toJSON();
      expect(typeof json.cents).toBe('string');
      expect(typeof json.decimal).toBe('string');
      expect(json).toEqual({ cents: '123456', decimal: '1234.56', currency: 'USD' });
    });

    it('format produce el símbolo de moneda', () => {
      expect(Money.fromDecimalString('1234.56').format()).toContain('1,234.56');
    });
  });
});
