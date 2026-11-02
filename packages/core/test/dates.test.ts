import { addDays, addMonths } from '../src';

describe('date helpers', () => {
  it('addMonths keeps the original day and clamps (§5.3)', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-01-31', 2)).toBe('2024-03-31');
    expect(addMonths('2024-07-01', 119)).toBe('2034-06-01');
    expect(addMonths('2024-03-01', -3)).toBe('2023-12-01');
  });
  it('addDays', () => {
    expect(addDays('2026-12-01', -3)).toBe('2026-11-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
  });
});
