"use client";

import { SurfaceCard, Text, EmptyNotice } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { channelRule, pad2, pillarBalance, slotsForMonth, vnParts, type Cadence, type ContentItem, type Pillar } from "@/lib/module-content-shared";
import { BAR_FILL_CLASS_NAME, BAR_TARGET_CLASS_NAME, BAR_TRACK_CLASS_NAME, LIST_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";

export type BalancePanelProps = {
  readonly items: ReadonlyArray<ContentItem>;
  readonly pillars: ReadonlyArray<Pillar>;
  readonly cadence: ReadonlyArray<Cadence>;
  readonly y: number;
  readonly m: number;
};

const pct = (n: number): number => Math.round(n * 100);

/** Pillar balance of the month shown in the calendar: a bar per theme (the dark tick is the share the weight asks for), then the cadence check. */
export const BalancePanel = ({ items, pillars, cadence, y, m }: BalancePanelProps) => {
  const t = useT(content);
  const monthItems = items.filter((i) => { if (!i.scheduled_at) return false; const p = vnParts(new Date(i.scheduled_at)); return p.y === y && p.m === m; });
  const rows = pillarBalance(pillars, monthItems);
  const slots = slotsForMonth(y, m, cadence);
  return (
    <>
      <SurfaceCard ariaLabel={t("balanceTitle")}>
        <div className="flex flex-col gap-1 px-4 pt-4">
          <Text weight="semibold">{t("balanceTitle")} · {t("balanceScope", { m: pad2(m), y })}</Text>
          <Text size="sm" tone="muted">{t("balanceBody")}</Text>
        </div>
        {monthItems.filter((i) => i.status !== "skipped").length === 0 ? <EmptyNotice message={t("balanceEmpty")} /> : (
          <ul className={LIST_CLASS_NAME}>
            {rows.map((r) => (
              <li key={r.pillarId ?? "none"} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <Text weight="medium">{r.name || t("balanceNone")}</Text>
                  <div className={BAR_TRACK_CLASS_NAME} role="img" aria-label={`${r.name || t("balanceNone")}: ${t("balanceActual", { n: r.count, p: pct(r.actualShare) })}${r.targetShare ? `, ${t("balanceTarget", { p: pct(r.targetShare) })}` : ""}`}>
                    <div className={BAR_FILL_CLASS_NAME} style={{ width: `${Math.min(100, pct(r.actualShare))}%` }} />
                    {r.targetShare > 0 ? <div className={BAR_TARGET_CLASS_NAME} style={{ left: `${Math.min(99.5, pct(r.targetShare))}%` }} /> : null}
                  </div>
                  <Text size="xs" tone="muted">{t("balanceActual", { n: r.count, p: pct(r.actualShare) })}{r.targetShare > 0 ? ` · ${t("balanceTarget", { p: pct(r.targetShare) })}` : ""}</Text>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
      {cadence.some((c) => c.posts_per_week > 0) ? (
        <SurfaceCard ariaLabel={t("cadenceTitle")}>
          <div className="flex flex-col gap-1 px-4 pt-4">
            <Text weight="semibold">{t("cadenceTitle")}</Text>
            <Text size="sm" tone="muted">{t("cadenceBody")}</Text>
          </div>
          <ul className={LIST_CLASS_NAME}>
            {cadence.filter((c) => c.posts_per_week > 0).map((c) => {
              const want = slots.filter((s) => s.channel === c.channel).length;
              const have = monthItems.filter((i) => i.status !== "skipped" && i.channels.includes(c.channel)).length;
              return (
                <li key={c.channel} className={ROW_CLASS_NAME}>
                  <div className={ROW_MAIN_CLASS_NAME}>
                    <Text size="sm">{t("cadenceRow", { channel: channelRule(c.channel).label, n: have, want })}</Text>
                    <div className={BAR_TRACK_CLASS_NAME} role="img" aria-label={t("cadenceRow", { channel: channelRule(c.channel).label, n: have, want })}>
                      <div className={BAR_FILL_CLASS_NAME} style={{ width: `${want ? Math.min(100, Math.round((have / want) * 100)) : 0}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SurfaceCard>
      ) : null}
    </>
  );
};
