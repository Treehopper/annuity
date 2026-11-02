/** Headless end-to-end flow against in-memory ports (§4.2 step 4). */
import { buildSchedule, computeKpis, createCore, validateLoan } from '../src';
import { inMemoryPorts } from './inMemoryPorts';
import { loan, monthly1100 } from './fixtures';

describe('core services (headless)', () => {
  it('create → activate → correct → confirm → duplicate → delete/restore', async () => {
    const ports = inMemoryPorts('2026-10-15');
    const core = createCore(ports);
    await core.init();
    expect(await ports.store.meta.get('schemaVersion')).toBe('1');

    const created = await core.loans.create(loan({ fixedRateMonths: 120 }, { name: 'DummyBank 10y', rules: [monthly1100] }));
    if (!created.ok) throw new Error(JSON.stringify(created.issues));
    const id = created.value.id;
    expect(created.value.status).toBe('offer');

    const active = await core.loans.activate(id);
    if (!active.ok) throw new Error('activate failed');
    expect(active.value.status).toBe('active');
    expect(active.value.baseline?.params).toEqual(active.value.params);

    // Contract data is locked for active loans unless re-baselining.
    const locked = await core.loans.update({ ...active.value, params: { ...active.value.params, principal: '290000.00' } });
    expect(locked.ok).toBe(false);

    const corrected = await core.specials.setOverride(id, { date: '2026-11-01', kind: 'changed', amount: '800.00', confirmed: false });
    if (!corrected.ok) throw new Error('override failed');
    const kpis = computeKpis(corrected.value, buildSchedule(corrected.value, { today: '2026-10-15' }), '2026-10-15');
    expect(kpis.payoff.totalInterest).toBe('44252.19'); // G8
    expect(kpis.unconfirmedSpecials).toBe(28);
    expect(kpis.thisMonth?.kind).toBe('current');
    expect(kpis.thisMonth?.row.closing).toBe('219939.51');

    const plan = buildSchedule(corrected.value, { today: '2026-10-15', useBaseline: true });
    expect(computeKpis(corrected.value, plan, '2026-10-15').payoff.totalInterest).toBe('44176.24');

    const confirmed = await core.specials.confirmPastAsPlanned(id);
    if (!confirmed.ok) throw new Error('confirm failed');
    const after = computeKpis(confirmed.value, buildSchedule(confirmed.value, { today: '2026-10-15' }), '2026-10-15');
    expect(after.unconfirmedSpecials).toBe(0);
    expect(after.payoff.totalInterest).toBe('44252.19');

    const dup = await core.loans.duplicate(id);
    if (!dup.ok) throw new Error('duplicate failed');
    expect(dup.value.name).toBe('DummyBank 10y (copy)');
    expect(dup.value.status).toBe('offer');
    expect(dup.value.baseline).toBeUndefined();
    expect(dup.value.specialOverrides.every((o) => !o.confirmed)).toBe(true);
    expect(dup.value.specialRules[0]!.id).not.toBe(monthly1100.id);

    const deleted = await core.loans.delete(id);
    expect(await core.loans.list()).toHaveLength(1);
    await core.loans.restore(deleted!);
    expect(await core.loans.list()).toHaveLength(2);
  });

  it('rejects invalid input with message keys', async () => {
    const core = createCore(inMemoryPorts());
    const res = await core.loans.create(loan({ principal: '500.00' }, { name: '  ' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.map((i) => i.messageKey).sort()).toEqual(['err.name.required', 'err.principal.range']);
  });

  it('template prefills dates relative to today (§5.11)', async () => {
    const core = createCore(inMemoryPorts('2026-10-15'));
    const t = await core.loans.template();
    expect(t.params.payoutDate).toBe('2026-11-01');
    expect(t.params.firstPaymentDate).toBe('2026-12-01');
  });

  it('template defaults: 10-year fixed rate, payment by amount', async () => {
    const t = await createCore(inMemoryPorts('2026-10-15')).loans.template();
    expect(t.params.fixedRateMonths).toBe(120);
    expect(t.params.payment).toEqual({ mode: 'fixedAmount', amount: '1375.00' });
    expect(validateLoan({ ...t, name: 'A' })).toEqual([]);
  });

  it('settings default and update', async () => {
    const core = createCore(inMemoryPorts());
    expect((await core.settings.get()).palette).toBe('classic');
    await core.settings.update({ palette: 'solarized' });
    expect((await core.settings.get()).palette).toBe('solarized');
  });
});
