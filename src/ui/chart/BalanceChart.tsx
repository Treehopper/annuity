import { useMemo, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Text } from '../components';
import { useTheme } from '../theme/useTheme';
import { space, systemFont } from '../theme/tokens';

export interface ChartSeries {
  name: string;
  color: 'chart1' | 'chart2' | 'chart3';
  /** Balance before the first payment (the loan amount). */
  opening?: number;
  /** Points: ISO date, balance, estimate flag (follow-up phase is drawn dotted). */
  points: { date: string; balance: number; estimate: boolean }[];
}

export interface BalanceChartProps {
  series: ChartSeries[];
  width: number;
  height?: number;
  fixedEnd?: { date: string; label: string };
  today?: { date: string; label: string };
  formatMoney(v: number): string;
  formatDate(iso: string): string;
  accessibilityLabel: string;
  estimateLabel: string;
}

const toYear = (iso: string) => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12;

/** Balance-over-time line chart on react-native-svg (§6.15). */
export function BalanceChart({ series, width, height = 200, fixedEnd, today, formatMoney, formatDate, accessibilityLabel, estimateLabel }: BalanceChartProps) {
  const { c } = useTheme();
  const [hover, setHover] = useState<number | undefined>();
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const w = Math.max(160, width);
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const geo = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (all.length === 0) return undefined;
    // Every series starts at the opening balance one month before its first payment.
    const x0 = Math.min(...all.map((p) => toYear(p.date))) - 1 / 12;
    const x1 = Math.max(...all.map((p) => toYear(p.date)));
    const yMax = Math.max(...all.map((p) => p.balance), ...series.map((s) => s.opening ?? 0), 1);
    const step = niceStep(yMax / 4);
    const top = Math.ceil(yMax / step) * step;
    const sx = (x: number) => pad.l + ((x - x0) / Math.max(x1 - x0, 1 / 12)) * iw;
    const sy = (y: number) => pad.t + ih - (y / top) * ih;
    const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    const span = Math.ceil(x1) - Math.floor(x0);
    const every = span > 12 ? 2 : 1;
    const xTicks: number[] = [];
    for (let y = Math.ceil(x0); y <= Math.floor(x1); y += every) xTicks.push(y);
    return { x0, x1, sx, sy, yTicks, xTicks, top };
  }, [series, iw, ih, pad.l, pad.t]);

  if (!geo) return null;
  const { sx, sy } = geo;

  const paths = series.map((s) => {
    const first = s.points[0];
    const startX = first ? toYear(first.date) - 1 / 12 : 0;
    let solid = '';
    let dotted = '';
    let prev = { x: sx(startX), y: sy(openingOf(s)) };
    for (const p of s.points) {
      const pt = { x: sx(toYear(p.date)), y: sy(p.balance) };
      const seg = `M${prev.x.toFixed(1)},${prev.y.toFixed(1)}L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      if (p.estimate) dotted += seg;
      else solid += seg;
      prev = pt;
    }
    return { s, solid, dotted };
  });

  const onMove = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0]!);
    let best = 0;
    let dist = Infinity;
    longest.points.forEach((p, i) => {
      const d = Math.abs(sx(toYear(p.date)) - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hoverDate = hover !== undefined ? series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0]!).points[hover]?.date : undefined;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ gap: space.s }}>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onMove}
        onResponderMove={onMove}
        onResponderRelease={() => setTimeout(() => setHover(undefined), 1500)}
        {...({ onMouseMove: (e: { nativeEvent: { offsetX: number } }) => onMove({ nativeEvent: { locationX: e.nativeEvent.offsetX } } as never), onMouseLeave: () => setHover(undefined) } as object)}>
        <Svg width={w} height={height}>
          {geo.yTicks.map((y) => (
            <G key={`y${y}`}>
              <Line x1={pad.l} x2={w - pad.r} y1={sy(y)} y2={sy(y)} stroke={c.border} strokeWidth={1} />
              <SvgText x={pad.l - 6} y={sy(y) + 4} fontSize={10} fontFamily={systemFont} fill={c.textMuted} textAnchor="end">
                {`${Math.round(y / 1000)}k`}
              </SvgText>
            </G>
          ))}
          {geo.xTicks.map((x) => (
            <SvgText key={`x${x}`} x={sx(x)} y={height - 8} fontSize={10} fontFamily={systemFont} fill={c.textMuted} textAnchor="middle">
              {String(x)}
            </SvgText>
          ))}
          {fixedEnd ? (
            <G>
              <Line x1={sx(toYear(fixedEnd.date))} x2={sx(toYear(fixedEnd.date))} y1={pad.t} y2={pad.t + ih} stroke={c.textMuted} strokeWidth={1.5} strokeDasharray="5,4" />
              <SvgText x={sx(toYear(fixedEnd.date)) + 4} y={pad.t + 10} fontSize={10} fontFamily={systemFont} fill={c.textMuted}>
                {fixedEnd.label}
              </SvgText>
            </G>
          ) : null}
          {today && toYear(today.date) >= geo.x0 && toYear(today.date) <= geo.x1 ? (
            <G>
              <Line x1={sx(toYear(today.date))} x2={sx(toYear(today.date))} y1={pad.t} y2={pad.t + ih} stroke={c.warning} strokeWidth={1.5} strokeDasharray="2,3" />
              <SvgText x={sx(toYear(today.date)) + 4} y={pad.t + ih - 4} fontSize={10} fontFamily={systemFont} fill={c.warning}>
                {today.label}
              </SvgText>
            </G>
          ) : null}
          {paths.map(({ s, solid, dotted }) => (
            <G key={s.name}>
              {solid ? <Path d={solid} stroke={c[s.color]} strokeWidth={2} fill="none" /> : null}
              {dotted ? <Path d={dotted} stroke={c[s.color]} strokeWidth={2} fill="none" strokeDasharray="2,4" strokeLinecap="round" /> : null}
            </G>
          ))}
          {hoverDate ? <Line x1={sx(toYear(hoverDate))} x2={sx(toYear(hoverDate))} y1={pad.t} y2={pad.t + ih} stroke={c.text} strokeWidth={1} /> : null}
        </Svg>
      </View>
      {hoverDate ? (
        <Text variant="small" style={{ fontVariant: ['tabular-nums'] }}>
          {formatDate(hoverDate)}:{' '}
          {series
            .map((s) => {
              const p = s.points.find((q) => q.date === hoverDate);
              return `${s.name} ${p ? formatMoney(p.balance) : '–'}`;
            })
            .join(' · ')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.l }}>
        {series.map((s) => (
          <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <View style={{ width: 16, height: 3, backgroundColor: c[s.color], borderRadius: 2 }} />
            <Text variant="small">{s.name}</Text>
          </View>
        ))}
        <Text variant="small">{`··· ${estimateLabel}`}</Text>
      </View>
    </View>
  );
}

function openingOf(s: ChartSeries): number {
  return s.opening ?? s.points[0]?.balance ?? 0;
}

function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}
