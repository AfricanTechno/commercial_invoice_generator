/**
 * Tests for js/catalogue.js — product data integrity
 */

// Load catalogue directly (it uses var, so we can eval it)
const fs = require('fs');
const path = require('path');

let CATALOGUE, CATALOGUE_GROUPS, DEFAULT_ORIGIN;

beforeAll(() => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'catalogue.js'), 'utf-8');
  const fn = new Function(src + '\nreturn { CATALOGUE, CATALOGUE_GROUPS, DEFAULT_ORIGIN };');
  const result = fn();
  CATALOGUE = result.CATALOGUE;
  CATALOGUE_GROUPS = result.CATALOGUE_GROUPS;
  DEFAULT_ORIGIN = result.DEFAULT_ORIGIN;
});

describe('Catalogue data', () => {
  test('CATALOGUE is a non-empty object', () => {
    expect(typeof CATALOGUE).toBe('object');
    expect(Object.keys(CATALOGUE).length).toBeGreaterThan(0);
  });

  test('DEFAULT_ORIGIN is a 2-letter country code', () => {
    expect(typeof DEFAULT_ORIGIN).toBe('string');
    expect(DEFAULT_ORIGIN).toMatch(/^[A-Z]{2}$/);
  });

  test('every product has required fields: hs, unit, sku, origin, weight', () => {
    Object.entries(CATALOGUE).forEach(([name, product]) => {
      expect(product).toHaveProperty('hs');
      expect(product).toHaveProperty('unit');
      expect(product).toHaveProperty('sku');
      expect(product).toHaveProperty('origin');
      expect(product).toHaveProperty('weight');
      expect(typeof product.hs).toBe('string');
      expect(typeof product.unit).toBe('number');
      expect(typeof product.sku).toBe('string');
      expect(typeof product.origin).toBe('string');
      expect(typeof product.weight).toBe('number');
    });
  });

  test('every product origin is a 2-letter code', () => {
    Object.entries(CATALOGUE).forEach(([name, product]) => {
      expect(product.origin).toMatch(/^[A-Z]{2}$/);
    });
  });

  test('every product weight is non-negative', () => {
    Object.entries(CATALOGUE).forEach(([name, product]) => {
      expect(product.weight).toBeGreaterThanOrEqual(0);
    });
  });

  test('every product unit price is non-negative', () => {
    Object.entries(CATALOGUE).forEach(([name, product]) => {
      expect(product.unit).toBeGreaterThanOrEqual(0);
    });
  });

  test('HS codes follow expected format (digits and dots)', () => {
    Object.entries(CATALOGUE).forEach(([name, product]) => {
      expect(product.hs).toMatch(/^[\d.]+$/);
    });
  });
});

describe('Catalogue groups', () => {
  test('CATALOGUE_GROUPS is a non-empty array', () => {
    expect(Array.isArray(CATALOGUE_GROUPS)).toBe(true);
    expect(CATALOGUE_GROUPS.length).toBeGreaterThan(0);
  });

  test('every group has label and items array', () => {
    CATALOGUE_GROUPS.forEach(group => {
      expect(typeof group.label).toBe('string');
      expect(Array.isArray(group.items)).toBe(true);
      expect(group.items.length).toBeGreaterThan(0);
    });
  });

  test('every grouped item exists in CATALOGUE', () => {
    CATALOGUE_GROUPS.forEach(group => {
      group.items.forEach(name => {
        expect(CATALOGUE).toHaveProperty(name);
      });
    });
  });

  test('every CATALOGUE product appears in at least one group', () => {
    const allGrouped = new Set();
    CATALOGUE_GROUPS.forEach(group => {
      group.items.forEach(name => allGrouped.add(name));
    });
    Object.keys(CATALOGUE).forEach(name => {
      expect(allGrouped.has(name)).toBe(true);
    });
  });

  test('no duplicate products across groups', () => {
    const seen = new Set();
    CATALOGUE_GROUPS.forEach(group => {
      group.items.forEach(name => {
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      });
    });
  });
});
