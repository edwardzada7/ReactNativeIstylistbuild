import { SERVICE_CATALOG, getAllSubServicesCatalog } from '../serviceCatalog';

describe('SERVICE_CATALOG', () => {
  it('keys every category by its own id', () => {
    Object.entries(SERVICE_CATALOG).forEach(([key, category]) => {
      expect(category.id).toBe(key);
      expect(category.name).toBeTruthy();
    });
  });

  it('keys every service by its own id and gives it at least one sub-service', () => {
    Object.values(SERVICE_CATALOG).forEach((category) => {
      Object.entries(category.services).forEach(([key, service]) => {
        expect(service.id).toBe(key);
        expect(service.subServices.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('getAllSubServicesCatalog', () => {
  const flat = getAllSubServicesCatalog();

  it('flattens every sub-service across all categories', () => {
    const expected = Object.values(SERVICE_CATALOG).reduce(
      (sum, cat) =>
        sum +
        Object.values(cat.services).reduce((s, svc) => s + svc.subServices.length, 0),
      0
    );
    expect(flat).toHaveLength(expected);
  });

  it('carries parent service + category slugs onto each flattened entry', () => {
    const haircut = flat.find((s) => s.id === 'haircut');
    expect(haircut).toBeDefined();
    expect(haircut).toMatchObject({
      name: 'Haircut',
      service_id: 'barbers',
      service_name: 'Barbers',
      category_id: 'beauty-grooming',
      category_name: 'Beauty & Grooming',
      default_duration: 30,
      default_price: 2000,
      requires_verification: false,
    });
  });

  it('propagates requires_verification from the parent service', () => {
    const botox = flat.find((s) => s.id === 'botox');
    expect(botox?.requires_verification).toBe(true);
  });

  it('maps camelCase catalog fields to snake_case output fields', () => {
    flat.forEach((sub) => {
      expect(typeof sub.default_duration).toBe('number');
      expect(typeof sub.default_price).toBe('number');
      expect(typeof sub.requires_verification).toBe('boolean');
    });
  });
});
