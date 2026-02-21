import { resolveNaturalDate } from './date-resolution.util';

describe('resolveNaturalDate', () => {
  it('resolves "coming monday" to the immediate upcoming Monday', () => {
    const now = new Date('2026-02-21T10:00:00Z'); // Saturday
    const resolved = resolveNaturalDate('coming monday', 'UTC', now);

    expect(resolved).toBe('2026-02-23');
  });

  it('resolves weekday tokens without modifiers', () => {
    const now = new Date('2026-02-21T10:00:00Z'); // Saturday
    const resolved = resolveNaturalDate('I need this on monday', 'UTC', now);

    expect(resolved).toBe('2026-02-23');
  });

  it('resolves tomorrow relative to the provided timezone date', () => {
    const now = new Date('2026-02-21T01:30:00Z'); // Friday local date in America/Los_Angeles
    const resolved = resolveNaturalDate('tomorrow afternoon', 'America/Los_Angeles', now);

    expect(resolved).toBe('2026-02-21');
  });

  it('returns explicit YYYY-MM-DD date when present', () => {
    const resolved = resolveNaturalDate('book me on 2026-03-10', 'UTC');

    expect(resolved).toBe('2026-03-10');
  });

  it('resolves "next two weeks tuesday" as Tuesday after two full weeks', () => {
    const now = new Date('2026-02-21T10:00:00Z'); // Saturday
    const resolved = resolveNaturalDate('next two weeks tuesday', 'UTC', now);

    expect(resolved).toBe('2026-03-10');
  });

  it('resolves "in 2 weeks" without weekday', () => {
    const now = new Date('2026-02-21T10:00:00Z'); // Saturday
    const resolved = resolveNaturalDate('in 2 weeks', 'UTC', now);

    expect(resolved).toBe('2026-03-07');
  });

  it('returns null when no temporal phrase is present', () => {
    const resolved = resolveNaturalDate('i need a pedicure', 'UTC');

    expect(resolved).toBeNull();
  });
});
