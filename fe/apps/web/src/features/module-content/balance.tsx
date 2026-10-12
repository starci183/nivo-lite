"use client";

import { EmptyNotice, ListItem, Meter, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { channelRule, pad2, pillarBalance, slotsForMonth, vnParts, type Cadence, type ContentItem, type Pillar } from "@/lib/module-content-shared";
import { ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";

export type BalancePanelProps = {
  readonly items: ReadonlyArray<ContentItem>;
  readonly pillars: ReadonlyArray<Pillar>;
  readonly cadence: ReadonlyArray<Cadence>;
  readonly y: number;
  readonly m: number;
};

const pct = (n: number): number => Math.round(n * 100);

/**
 * Pillar balance of the month shown in the calendar: a meter per theme (the share the weight asks for is written beside it), then the cadence check.
 * grammar gap: Meter has no target marker, so the target share is stated in words instead of drawn as a tick.
 */
export const BalancePanel = ({ items, pillars, cadence, y, m }: BalancePanelProps) => {
  const t = useT(content);
  const monthItems = items.filter((i) => { if (!i.scheduled_at) return false; const p = vnParts(new Date(i.scheduled_at)); return p.y === y && p.m === m; });
  const rows = pillarBalance(pillars, monthItems);
  const slots = slotsForMonth(y, m, cadence);
  const hasPosts = monthItems.filter((i) => i.status !== "skipped").length > 0;
  return (
    <>
      <SectionHeader level={2} title={`${t("balanceTitle")} · ${t("balanceScope", { m: pad2(m), y })}`} description={t("balanceBody")} />
      <SurfaceListCard ariaLabel={t("balanceTitle")} empty={<EmptyNotice message={t("balanceEmpty")} />}>
        {hasPosts ? rows.map((r) => {
          const name = r.name || t("balanceNone");
          const actual = t("balanceActual", { n: r.count, p: pct(r.actualShare) });
          return (
            <ListItem key={r.pillarId ?? "none"} className={ROW_CLASS_NAME}>
              <div className={ROW_MAIN_CLASS_NAME}>
                <Meter label={name} value={Math.min(100, pct(r.actualShare))} valueLabel={actual} />
                {r.targetShare > 0 ? <Text size="xs" tone="muted">{t("balanceTarget", { p: pct(r.targetShare) })}</Text> : null}
              </div>
            </ListItem>
          );
        }) : null}
      </SurfaceListCard>
      {cadence.some((c) => c.posts_per_week > 0) ? (
        <>
          <SectionHeader level={2} title={t("cadenceTitle")} description={t("cadenceBody")} />
          <SurfaceListCard ariaLabel={t("cadenceTitle")}>
            {cadence.filter((c) => c.posts_per_week > 0).map((c) => {
              const want = slots.filter((s) => s.channel === c.channel).length;
              const have = monthItems.filter((i) => i.status !== "skipped" && i.channels.includes(c.channel)).length;
              return (
                <ListItem key={c.channel} className={ROW_CLASS_NAME}>
                  <div className={ROW_MAIN_CLASS_NAME}>
                    <Meter
                      label={channelRule(c.channel).label} value={want ? Math.min(want, have) : 0} maxValue={Math.max(1, want)}
                      valueLabel={t("cadenceRow", { channel: channelRule(c.channel).label, n: have, want })}
                    />
                  </div>
                </ListItem>
              );
            })}
          </SurfaceListCard>
        </>
      ) : null}
    </>
  );
};
