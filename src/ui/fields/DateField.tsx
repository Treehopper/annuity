import { isISODate } from '@alp/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '../components';

export interface DateFieldProps {
  label: string;
  value: string | undefined;
  onChange(v: string | undefined): void;
  error?: string;
  disabled?: boolean;
  testID?: string;
  min?: string;
  max?: string;
  optional?: boolean;
}

function toDisplay(iso: string | undefined, de: boolean) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return de ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
}

function fromDisplay(text: string, de: boolean): string | undefined {
  const m = de ? /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim()) : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return isISODate(text.trim()) ? text.trim() : undefined;
  const [d, mo] = de ? [m[1], m[2]] : [m[2], m[1]];
  const iso = `${m[3]}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  return isISODate(iso) ? iso : undefined;
}

/** Text-based date entry for native (DD.MM.YYYY / MM/DD/YYYY). */
export function DateField({ label, value, onChange, error, disabled, testID, optional }: DateFieldProps) {
  const { i18n, t } = useTranslation();
  const de = i18n.language === 'de';
  const [text, setText] = useState(toDisplay(value, de));
  // Re-sync the text when the value or language changes from outside.
  const [synced, setSynced] = useState({ value, de });
  if (synced.value !== value || synced.de !== de) {
    setSynced({ value, de });
    setText(toDisplay(value, de));
  }
  return (
    <Field
      label={label}
      value={text}
      editable={!disabled}
      testID={testID}
      placeholder={de ? 'TT.MM.JJJJ' : 'MM/DD/YYYY'}
      keyboardType="numbers-and-punctuation"
      error={error}
      containerStyle={{ flex: 1, minWidth: 150 }}
      onChangeText={setText}
      onBlur={() => {
        if (text.trim() === '' && optional) return onChange(undefined);
        const iso = fromDisplay(text, de);
        if (iso) onChange(iso);
        else setText(toDisplay(value, de));
      }}
      hint={!value && optional ? t('edit.ruleEndOpen') : undefined}
    />
  );
}
