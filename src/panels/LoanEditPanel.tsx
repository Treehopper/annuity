import {
  buildSchedule,
  computeKpis,
  defaultFirstPaymentDate,
  equivalentInitialRepayment,
  computeAnnuity,
  validateLoan,
  type Loan,
  type ValidationIssue,
} from '@alp/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useFormat } from '@/features/format';
import { applyFormPatch, formFromLoan, loanFromForm, newRuleForm, relocalizeForm, useDraftStore, type LoanForm, type RuleForm } from '@/features/loanForm';
import { useToday } from '@/features/projections';
import type { AppLanguage } from '@/i18n';
import { getCore } from '@/composition';
import { useAppStore } from '@/store/appStore';
import { Banner, Button, Card, Chip, Divider, Field, IconButton, SectionTitle, Segmented, Text, Toggle } from '@/ui/components';
import { DateField } from '@/ui/fields/DateField';
import { usePanelChrome } from '@/ui/layout/chrome';
import { usePaneWidth } from '@/ui/layout/layout';
import { AdaptiveSheet, askConfirm } from '@/ui/overlays';
import { useTheme } from '@/ui/theme/useTheme';
import { radius, space } from '@/ui/theme/tokens';

export interface LoanEditPanelProps {
  /** Loan id, or undefined for a new loan. */
  loanId?: string;
  onSaved(id: string, isNew: boolean): void;
  onCancel(): void;
}

/** New / edit loan (§6.3) with financing helper (§6.4). */
export function LoanEditPanel({ loanId, onSaved, onCancel }: LoanEditPanelProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language === 'de' ? 'de' : 'en') as AppLanguage;
  const existing = useAppStore((s) => (loanId ? s.loans.find((l) => l.id === loanId) : undefined));
  const draftKey = loanId ?? 'new';
  const draft = useDraftStore((s) => s.drafts[draftKey]);
  const setDraft = useDraftStore((s) => s.set);
  const [initial, setInitial] = useState<LoanForm | undefined>(draft);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveIssues, setSaveIssues] = useState<ValidationIssue[]>([]);

  // Load the loan or a fresh template once.
  useEffect(() => {
    if (draft || initial) return;
    let cancelled = false;
    void (async () => {
      const loan = existing ?? (await getCore().loans.template());
      if (cancelled) return;
      const form = formFromLoan(loan, lang);
      setInitial(form);
      setDraft(draftKey, form);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, initial, existing, lang, draftKey, setDraft]);

  // The draft outlives a language switch in Settings: show and parse it in the current language.
  const stored = draft ?? initial;
  const form = useMemo(() => stored && relocalizeForm(stored, lang), [stored, lang]);
  const initialForm = useMemo(() => initial && relocalizeForm(initial, lang), [initial, lang]);
  const update = (patch: Partial<LoanForm>) => form && setDraft(draftKey, applyFormPatch(form, patch));

  const built = useMemo(() => (form ? loanFromForm(form) : undefined), [form]);
  const issues = useMemo(() => (built?.loan ? validateLoan(built.loan) : []), [built]);

  const isNew = !loanId;
  const status = existing?.status ?? 'offer';
  const contractLocked = status === 'closed' || (status === 'active' && !form?.contractUnlocked);
  const readOnly = status === 'closed';
  const dirty = !!form && !!initialForm && JSON.stringify({ ...form, base: null }) !== JSON.stringify({ ...initialForm, base: null });

  const save = async () => {
    if (!form || !built) return;
    setShowErrors(true);
    if (!built.loan || issues.some((i) => i.severity === 'error')) return;
    setSaving(true);
    const res = await useAppStore.getState().saveLoan(built.loan, { isNew, rebaseline: form.contractUnlocked });
    setSaving(false);
    if (!res.ok) {
      setSaveIssues(res.issues);
      return;
    }
    setDraft(draftKey, undefined);
    onSaved(res.value.id, isNew);
  };

  const cancel = async () => {
    if (dirty) {
      const ok = await askConfirm({
        title: t('edit.discardTitle'),
        text: t('edit.discardText'),
        confirmLabel: t('edit.discard'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    setDraft(draftKey, undefined);
    onCancel();
  };

  usePanelChrome(
    {
      title: isNew ? t('edit.titleNew') : t('edit.titleEdit'),
      actions: [
        { key: 'cancel', label: t('common.cancel'), icon: 'close', primary: true, onPress: cancel, testID: 'edit-cancel' },
        { key: 'save', label: t('common.save'), primary: true, onPress: save, disabled: saving, testID: 'edit-save' },
      ],
    },
    [form, built, issues, saving, t],
  );

  if (!form || !built) return <Text style={{ padding: space.l }}>{t('common.loading')}</Text>;

  const errorFor = (path: string): string | undefined => {
    const parse = built.parseErrors[path];
    if (parse) return t(parse);
    const issue = [...issues, ...saveIssues].find((i) => i.severity === 'error' && (i.path === path || i.path.startsWith(path + '.')));
    if (!issue) return undefined;
    // Name errors only after the first save attempt, so a fresh form isn't red.
    if (path === 'name' && !showErrors) return undefined;
    return t(issue.messageKey, issue.params);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: 120, gap: space.m, maxWidth: 720, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Field label={t('edit.lender')} value={form.lender} onChangeText={(lender) => update({ lender })} testID="field-lender" />
        <Field
          label={t('edit.name')}
          value={form.name}
          placeholder={t('edit.namePlaceholder')}
          onChangeText={(name) => update({ name, nameTouched: true })}
          error={errorFor('name')}
          maxLength={80}
          testID="field-name"
        />

        <LoanSection form={form} update={update} errorFor={errorFor} locked={contractLocked} />
        {status === 'active' && !form.contractUnlocked ? (
          <Banner
            text={t('edit.contractLocked')}
            tone="primary"
            icon="lock-closed"
            action={
              <Button
                kind="secondary"
                compact
                label={t('edit.unlockContract')}
                testID="unlock-contract"
                onPress={async () => {
                  const ok = await askConfirm({ title: t('edit.unlockTitle'), text: t('edit.unlockText'), confirmLabel: t('common.confirm'), cancelLabel: t('common.cancel') });
                  if (ok) update({ contractUnlocked: true });
                }}
              />
            }
          />
        ) : null}
        <PaymentSection form={form} update={update} errorFor={errorFor} locked={contractLocked} loan={built.loan} />
        <SpecialSection form={form} update={update} errorFor={errorFor} locked={readOnly} />
        <FollowUpSection form={form} update={update} errorFor={errorFor} locked={readOnly} />

        <SectionTitle>{t('edit.advanced')}</SectionTitle>
        <Text variant="muted">{t('edit.rounding')}</Text>
        <Segmented
          testID="rounding"
          value={form.rounding}
          onChange={(rounding) => !contractLocked && update({ rounding })}
          options={[
            { value: 'bank', label: t('edit.roundingBank') },
            { value: 'spreadsheet', label: t('edit.roundingSpreadsheet') },
          ]}
        />
        <Field label={t('edit.notes')} value={form.notes} onChangeText={(notes) => update({ notes })} multiline maxLength={2000} inputStyle={{ minHeight: 80 }} error={errorFor('notes')} />
      </ScrollView>
      <PreviewBar loan={built.loan} issues={issues} />
    </View>
  );
}

type SectionProps = {
  form: LoanForm;
  update(p: Partial<LoanForm>): void;
  errorFor(path: string): string | undefined;
  locked: boolean;
};

function LoanSection({ form, update, errorFor, locked }: SectionProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const [helperOpen, setHelperOpen] = useState(false);
  const presets: LoanForm['fixedPreset'][] = ['60', '120', '180', 'custom'];
  return (
    <>
      <SectionTitle>{t('edit.sectionLoan')}</SectionTitle>
      <Field
        label={t('edit.principal')}
        value={form.principal}
        onChangeText={(principal) => update({ principal })}
        onBlur={() => {
          const v = loanFromForm(form).loan?.params.principal;
          if (v) update({ principal: f.moneyInput(v) });
        }}
        keyboardType="decimal-pad"
        inputMode="decimal"
        align="right"
        suffix="€"
        editable={!locked}
        error={errorFor('params.principal')}
        testID="field-principal"
        right={<IconButton icon="calculator-outline" label={t('edit.deriveHelper')} onPress={() => setHelperOpen(true)} disabled={locked} testID="open-helper" />}
      />
      <Field
        label={t('edit.rate')}
        value={form.rate}
        onChangeText={(rate) => update({ rate, ...(form.followUpRate === form.rate ? { followUpRate: rate } : {}) })}
        keyboardType="decimal-pad"
        inputMode="decimal"
        align="right"
        suffix="%"
        editable={!locked}
        error={errorFor('params.nominalRate')}
        testID="field-rate"
      />
      <Text variant="muted">{t('edit.fixedPeriod')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        {presets.map((p) => (
          <Chip
            key={p}
            testID={`fixed-${p}`}
            label={p === 'custom' ? t('edit.custom') : `${Number(p) / 12} ${t('common.years')}`}
            selected={form.fixedPreset === p}
            onPress={() => !locked && update({ fixedPreset: p, fixedMonths: p === 'custom' ? form.fixedMonths : p })}
          />
        ))}
      </View>
      {form.fixedPreset === 'custom' ? (
        <Field
          label={t('edit.fixedMonths')}
          value={form.fixedMonths}
          onChangeText={(fixedMonths) => update({ fixedMonths: fixedMonths.replace(/\D/g, '') })}
          keyboardType="number-pad"
          inputMode="numeric"
          align="right"
          editable={!locked}
          error={errorFor('params.fixedRateMonths')}
          testID="field-fixed-months"
        />
      ) : errorFor('params.fixedRateMonths') ? (
        <Text variant="small" color="danger">
          {errorFor('params.fixedRateMonths')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.m, flexWrap: 'wrap' }}>
        <DateField
          label={t('edit.payoutDate')}
          value={form.payoutDate}
          disabled={locked}
          testID="field-payout"
          error={errorFor('params.payoutDate')}
          onChange={(payoutDate) =>
            update({
              payoutDate,
              ...(!form.firstPaymentTouched && payoutDate ? { firstPaymentDate: defaultFirstPaymentDate(payoutDate) } : {}),
            })
          }
        />
        <DateField
          label={t('edit.firstPayment')}
          value={form.firstPaymentDate}
          disabled={locked}
          testID="field-first-payment"
          error={errorFor('params.firstPaymentDate')}
          onChange={(firstPaymentDate) => update({ firstPaymentDate, firstPaymentTouched: true })}
        />
      </View>
      <FinancingHelperSheet
        visible={helperOpen}
        form={form}
        onClose={() => setHelperOpen(false)}
        onApply={(helper, principal) => {
          update({ helper, principal });
          setHelperOpen(false);
        }}
      />
    </>
  );
}

function PaymentSection({ form, update, errorFor, locked, loan }: SectionProps & { loan?: Loan }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { c } = useTheme();
  const hints = useMemo(() => {
    if (!loan) return undefined;
    try {
      const annuity = computeAnnuity(loan.params);
      const t0 = equivalentInitialRepayment(loan.params);
      const dry = buildSchedule({ ...loan, specialRules: [], specialOverrides: [], status: 'offer' }, {}).length;
      return { annuity, repayment: t0.toString(), months: dry };
    } catch {
      return undefined;
    }
  }, [loan]);
  return (
    <>
      <SectionTitle>{t('edit.sectionPayment')}</SectionTitle>
      <Segmented
        testID="payment-mode"
        value={form.mode}
        onChange={(mode) => !locked && update({ mode })}
        options={[
          { value: 'initialRepayment', label: t('edit.modes.initialRepayment') },
          { value: 'term', label: t('edit.modes.term') },
          { value: 'fixedAmount', label: t('edit.modes.fixedAmount') },
        ]}
      />
      {form.mode === 'initialRepayment' ? (
        <Field
          label={t('edit.initialRepayment')}
          value={form.initialRepayment}
          onChangeText={(initialRepayment) => update({ initialRepayment })}
          keyboardType="decimal-pad"
          inputMode="decimal"
          align="right"
          suffix="%"
          editable={!locked}
          error={errorFor('params.payment.initialRepaymentRate')}
          testID="field-initial-repayment"
        />
      ) : form.mode === 'term' ? (
        <Field
          label={t('edit.termYears')}
          value={form.termYears}
          onChangeText={(termYears) => update({ termYears })}
          keyboardType="decimal-pad"
          inputMode="decimal"
          align="right"
          suffix={t('common.years')}
          editable={!locked}
          error={errorFor('params.payment.termMonths')}
          testID="field-term"
        />
      ) : (
        <Field
          label={t('edit.amount')}
          value={form.amount}
          onChangeText={(amount) => update({ amount })}
          keyboardType="decimal-pad"
          inputMode="decimal"
          align="right"
          suffix="€"
          editable={!locked}
          error={errorFor('params.payment.amount')}
          testID="field-amount"
        />
      )}
      {hints ? (
        <View style={{ gap: space.xs, padding: space.m, borderRadius: radius.m, backgroundColor: c.surfaceAlt }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text bold>{t('edit.paymentResult')}</Text>
            <Text variant="amountLarge" testID="payment-result">
              {f.money(hints.annuity)}
            </Text>
          </View>
          {form.mode !== 'initialRepayment' ? <Text variant="muted">{t('edit.hintRepayment', { rate: f.percent(hints.repayment) })}</Text> : null}
          {form.mode !== 'term' ? (
            <Text variant="muted">{t('edit.hintTerm', { years: Math.floor(hints.months / 12), months: hints.months % 12 })}</Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function SpecialSection({ form, update, errorFor, locked }: SectionProps) {
  const { t } = useTranslation();
  const setRule = (idx: number, patch: Partial<RuleForm>) => update({ rules: form.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  return (
    <>
      <SectionTitle>{t('edit.sectionSpecial')}</SectionTitle>
      {form.rules.map((r, idx) => (
        <Card key={r.id} testID={`rule-${idx}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <View style={{ flex: 1 }}>
              <Segmented
                testID={`rule-${idx}-frequency`}
                value={r.frequency}
                onChange={(frequency) => !locked && setRule(idx, { frequency })}
                options={[
                  { value: 'monthly', label: t('edit.monthly') },
                  { value: 'yearly', label: t('edit.yearly') },
                ]}
              />
            </View>
            <IconButton icon="trash-outline" label={t('edit.removeRule')} disabled={locked} onPress={() => update({ rules: form.rules.filter((_, i) => i !== idx) })} />
          </View>
          {r.frequency === 'yearly' ? <MonthPicker value={r.month} onChange={(month) => setRule(idx, { month })} disabled={locked} /> : null}
          <Field
            label={t('edit.ruleAmount')}
            value={r.amount}
            onChangeText={(amount) => setRule(idx, { amount })}
            keyboardType="decimal-pad"
            inputMode="decimal"
            align="right"
            suffix="€"
            editable={!locked}
            error={errorFor(`specialRules.${idx}.amount`) ?? errorFor(`specialRules.${idx}.month`)}
            testID={`rule-${idx}-amount`}
          />
          <View style={{ flexDirection: 'row', gap: space.m, flexWrap: 'wrap' }}>
            <DateField label={t('edit.ruleStart')} value={r.start} onChange={(start) => start && setRule(idx, { start })} disabled={locked} error={errorFor(`specialRules.${idx}.start`)} />
            <DateField label={t('edit.ruleEnd')} value={r.end} optional onChange={(end) => setRule(idx, { end, endFollowsFixed: false })} disabled={locked} error={errorFor(`specialRules.${idx}.end`)} />
          </View>
        </Card>
      ))}
      {!locked ? (
        <Button
          kind="secondary"
          icon="add"
          label={t('edit.addRule')}
          testID="add-rule"
          onPress={() =>
            update({
              rules: [...form.rules, newRuleForm(form, `rule-${Date.now().toString(36)}-${form.rules.length}`)],
            })
          }
        />
      ) : null}
    </>
  );
}

function MonthPicker({ value, onChange, disabled }: { value: number; onChange(m: number): void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="muted">{t('edit.ruleMonth')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <Chip key={m} label={t(`months.${m}`).slice(0, 3)} selected={m === value} onPress={() => !disabled && onChange(m)} />
        ))}
      </View>
    </View>
  );
}

function FollowUpSection({ form, update, errorFor, locked }: SectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionTitle>{t('edit.sectionFollowUp')}</SectionTitle>
      <Field
        label={t('edit.assumedRate')}
        value={form.followUpRate}
        onChangeText={(followUpRate) => update({ followUpRate })}
        keyboardType="decimal-pad"
        inputMode="decimal"
        align="right"
        suffix="%"
        editable={!locked}
        error={errorFor('followUp.rate')}
        testID="field-followup-rate"
      />
      <Segmented
        testID="followup-mode"
        value={form.followUpMode}
        onChange={(followUpMode) => !locked && update({ followUpMode })}
        options={[
          { value: 'keepPayment', label: t('edit.keepPayment') },
          { value: 'repaymentRate', label: t('edit.repaymentRate') },
        ]}
      />
      {form.followUpMode === 'repaymentRate' ? (
        <Field
          label={t('edit.repaymentRate')}
          value={form.followUpRepayment}
          onChangeText={(followUpRepayment) => update({ followUpRepayment })}
          keyboardType="decimal-pad"
          inputMode="decimal"
          align="right"
          suffix="%"
          editable={!locked}
          error={errorFor('followUp.payment.rate')}
        />
      ) : null}
      {errorFor('followUp.payment') ? (
        <Text variant="small" color="danger">
          {errorFor('followUp.payment')}
        </Text>
      ) : null}
      <Toggle label={t('edit.keepSpecialRules')} value={form.keepSpecialRules} onChange={(keepSpecialRules) => !locked && update({ keepSpecialRules })} />
    </>
  );
}

function FinancingHelperSheet({
  visible,
  form,
  onClose,
  onApply,
}: {
  visible: boolean;
  form: LoanForm;
  onClose(): void;
  onApply(helper: NonNullable<LoanForm['helper']>, principal: string): void;
}) {
  // Mounted only while open, so the inputs start from the stored helper values each time.
  return visible ? <FinancingHelperBody form={form} onClose={onClose} onApply={onApply} /> : null;
}

function FinancingHelperBody({ form, onClose, onApply }: { form: LoanForm; onClose(): void; onApply(helper: NonNullable<LoanForm['helper']>, principal: string): void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [h, setH] = useState(form.helper ?? { purchasePrice: '', incidentalCosts: '', equity: '' });
  const parse = (s: string) => (s.trim() === '' ? 0 : Number(loanFromForm({ ...form, principal: s }).loan?.params.principal ?? NaN));
  const values = [parse(h.purchasePrice), parse(h.incidentalCosts), parse(h.equity)];
  const invalid = values.some((v) => !Number.isFinite(v) || v < 0);
  const result = invalid ? NaN : values[0]! + values[1]! - values[2]!;
  const ok = Number.isFinite(result) && result > 0;
  return (
    <AdaptiveSheet
      visible
      title={t('helper.title')}
      onClose={onClose}
      testID="helper-sheet"
      footer={<Button label={t('common.apply')} disabled={!ok} testID="helper-apply" onPress={() => onApply(h, f.moneyInput(result.toFixed(2)))} />}>
      <Field label={t('helper.purchasePrice')} value={h.purchasePrice} onChangeText={(purchasePrice) => setH({ ...h, purchasePrice })} keyboardType="decimal-pad" inputMode="decimal" align="right" suffix="€" testID="helper-price" />
      <Field
        label={t('helper.incidentalCosts')}
        hint={t('helper.incidentalHint')}
        value={h.incidentalCosts}
        onChangeText={(incidentalCosts) => setH({ ...h, incidentalCosts })}
        keyboardType="decimal-pad"
        inputMode="decimal"
        align="right"
        suffix="€"
        testID="helper-costs"
      />
      <Field label={t('helper.equity')} value={h.equity} onChangeText={(equity) => setH({ ...h, equity })} keyboardType="decimal-pad" inputMode="decimal" align="right" suffix="€" testID="helper-equity" />
      <Divider />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text bold>{t('helper.result')}</Text>
        <Text variant="amountLarge" color={ok ? 'text' : 'danger'} testID="helper-result">
          {Number.isFinite(result) ? f.money(result) : '–'}
        </Text>
      </View>
      {!ok && !invalid && values.some((v) => v > 0) ? (
        <Text variant="small" color="danger">
          {t('err.helper.equityTooHigh')}
        </Text>
      ) : invalid ? (
        <Text variant="small" color="danger">
          {t('err.helper.negative')}
        </Text>
      ) : null}
    </AdaptiveSheet>
  );
}

/** Sticky live preview: payoff · fixed-rate end balance · interest (§6.3). */
function PreviewBar({ loan, issues }: { loan?: Loan; issues: ValidationIssue[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { c } = useTheme();
  const today = useToday();
  const width = usePaneWidth();
  const kpis = useMemo(() => {
    if (!loan || issues.some((i) => i.severity === 'error' && i.path !== 'name')) return undefined;
    return computeKpis(loan, buildSchedule(loan, { today }), today);
  }, [loan, issues, today]);
  return (
    <View
      testID="preview-bar"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.m, paddingHorizontal: space.l, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
      {kpis ? (
        <Text bold={width > 400} style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {t('edit.preview', {
            payoff: f.monthYear(kpis.payoff.date) + (kpis.payoff.isEstimate ? '*' : ''),
            balance: f.moneyRound(kpis.atFixedRateEnd.balance),
            interest: f.moneyRound(kpis.payoff.totalInterest) + (kpis.payoff.isEstimate ? '*' : ''),
          })}
        </Text>
      ) : (
        <Text variant="muted" style={{ textAlign: 'center' }}>
          {t('edit.previewInvalid')}
        </Text>
      )}
    </View>
  );
}
