"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { daysInMonth, isoWeekday, pad2, vnDateKey, vnParts, type ContentItem, type Pillar } from "@/lib/module-content-shared";
import { moveItemAction } from "./actions";
import { AGENDA_WRAP_CLASS_NAME, CELL_CLASS_NAME, CELL_DROP_CLASS_NAME, CELL_OUT_CLASS_NAME, CELL_TODAY_CLASS_NAME, CHIP_CLASS_NAME, CHIPS_CLASS_NAME, GRID_CLASS_NAME, GRID_HEAD_CLASS_NAME, GRID_WRAP_CLASS_NAME, LIST_CLASS_NAME, ROW_BUTTON_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { dateText, moveToDay, timeText } from "./format";
import { ChannelBadges, pillarBorder, StatusBadge } from "./parts";

export type CalendarProps = {
  readonly items: ReadonlyArray<ContentItem>;
  readonly pillars: ReadonlyArray<Pillar>;
  readonly y: number;
  readonly m: number;
  readonly nowIso: string;
  readonly canManage: boolean;
  readonly onOpen: (id: string) => void;
  readonly onError: (message: string) => void;
  readonly hasSetup: boolean;
  readonly onOpenSettings: () => void;
};

const MAX_CHIPS = 3;

const inMonth = (iso: string | null, y: number, m: number): boolean => {
  if (!iso) return false;
  const p = vnParts(new Date(iso));
  return p.y === y && p.m === m;
};

/** Month calendar (drag a post to another day to reschedule); on phones the same month is an agenda list. */
export const MonthCalendar = ({ items, pillars, y, m, nowIso, canManage, onOpen, onError, hasSetup, onOpenSettings }: CalendarProps) => {
  const t = useT(content);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const todayKey = vnDateKey(new Date(nowIso));
  const monthItems = useMemo(() => items.filter((i) => inMonth(i.scheduled_at, y, m)).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")), [items, y, m]);
  const byDay = useMemo(() => {
    const map = new Map<string, Array<ContentItem>>();
    for (const i of monthItems) {
      const k = vnDateKey(new Date(i.scheduled_at as string));
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return map;
  }, [monthItems]);
  const unscheduled = items.filter((i) => !i.scheduled_at && i.status !== "skipped" && i.status !== "published");

  const dim = daysInMonth(y, m);
  const lead = isoWeekday(y, m, 1) - 1;
  const cells: Array<{ day: number | null }> = [...Array.from({ length: lead }, () => ({ day: null })), ...Array.from({ length: dim }, (_, i) => ({ day: i + 1 }))];
  while (cells.length % 7) cells.push({ day: null });

  const drop = (day: number) => {
    const id = dragId;
    setDragId(null);
    setOverKey(null);
    if (!canManage || !id) return;
    const item = items.find((i) => i.id === id);
    if (!item || item.status === "published") return;
    const at = moveToDay(item.scheduled_at, y, m, day);
    if (at === item.scheduled_at) return;
    startTransition(async () => {
      const r = await moveItemAction(id, at);
      if (r.ok) router.refresh();
      else onError(t("actionFailed", { error: r.error }));
    });
  };

  const chip = (i: ContentItem) => (
    <button
      key={i.id} type="button" draggable={canManage && i.status !== "published"}
      onDragStart={(e) => { setDragId(i.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", i.id); }}
      onDragEnd={() => { setDragId(null); setOverKey(null); }}
      onClick={() => onOpen(i.id)} className={`${CHIP_CLASS_NAME} ${pillarBorder(pillars, i.pillar_id)} ${i.status === "skipped" ? "opacity-50" : ""}`}
      aria-label={`${timeText(i.scheduled_at)} ${i.title}`}
    >
      <Text as="span" size="xs" tone="muted">{timeText(i.scheduled_at)} · {t(`status_${i.status}`)}</Text>
      <Text as="span" size="xs" weight="medium" overflow="clamp-2">{i.title}</Text>
    </button>
  );

  if (!hasSetup && items.length === 0) {
    return (
      <SurfaceCard ariaLabel={t("setupFirstTitle")}>
        <EmptyNotice message={t("setupFirstTitle")} description={t("setupFirstBody")} />
        <Button variant="secondary" onPress={onOpenSettings}>{t("openSettings")}</Button>
      </SurfaceCard>
    );
  }

  const weekdays = t("weekdays").split(",");
  return (
    <>
      <div className={GRID_WRAP_CLASS_NAME}>
        <div className={GRID_CLASS_NAME} role="grid" aria-label={t("monthTitle", { m: pad2(m), y })}>
          {weekdays.map((d) => <div key={d} role="columnheader" className={GRID_HEAD_CLASS_NAME}><Text as="span" size="xs" weight="semibold" tone="muted">{d}</Text></div>)}
          {cells.map((c, idx) => {
            if (c.day === null) return <div key={`e${idx}`} className={`${CELL_CLASS_NAME} ${CELL_OUT_CLASS_NAME}`} role="gridcell" aria-hidden />;
            const key = `${y}-${pad2(m)}-${pad2(c.day)}`;
            const list = byDay.get(key) ?? [];
            const shown = expanded === key ? list : list.slice(0, MAX_CHIPS);
            return (
              <div
                key={key} role="gridcell" aria-label={`${c.day}/${m}`}
                className={`${CELL_CLASS_NAME} ${key === todayKey ? CELL_TODAY_CLASS_NAME : ""} ${overKey === key ? CELL_DROP_CLASS_NAME : ""}`}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverKey(key); } }}
                onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => { e.preventDefault(); drop(c.day as number); }}
              >
                <Text as="span" size="xs" weight={key === todayKey ? "semibold" : "normal"} tone={key === todayKey ? "accent" : "muted"}>{c.day}</Text>
                {shown.map(chip)}
                {list.length > MAX_CHIPS && expanded !== key ? <Button variant="ghost" size="sm" onPress={() => setExpanded(key)}>{t("moreItems", { n: list.length - MAX_CHIPS })}</Button> : null}
              </div>
            );
          })}
        </div>
        {canManage ? <Text size="xs" tone="muted">{t("dragHint")}</Text> : null}
        {monthItems.length === 0 ? <Text size="sm" tone="muted">{t("emptyMonthBody")}</Text> : null}
      </div>

      <div className={AGENDA_WRAP_CLASS_NAME}>
        <SurfaceCard ariaLabel={t("monthTitle", { m: pad2(m), y })}>
          {monthItems.length === 0 ? <EmptyNotice message={t("emptyMonthTitle")} description={t("emptyMonthBody")} /> : (
            <ul className={LIST_CLASS_NAME}>
              {monthItems.map((i) => (
                <li key={i.id} className={ROW_CLASS_NAME}>
                  <button type="button" className={ROW_BUTTON_CLASS_NAME} onClick={() => onOpen(i.id)}>
                    <div className={ROW_MAIN_CLASS_NAME}>
                      <Text size="xs" tone="muted">{dateText(i.scheduled_at)} · {timeText(i.scheduled_at)}</Text>
                      <Text weight="semibold">{i.title}</Text>
                      <div className={CHIPS_CLASS_NAME}><StatusBadge status={i.status} /><ChannelBadges channels={i.channels} /></div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      {unscheduled.length ? (
        <SurfaceCard ariaLabel={t("noDateTitle")}>
          <ul className={LIST_CLASS_NAME}>
            <li className={ROW_CLASS_NAME}><Text weight="semibold">{t("noDateTitle")}</Text></li>
            {unscheduled.map((i) => (
              <li key={i.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <div className={CHIPS_CLASS_NAME}>{chip(i)}<StatusBadge status={i.status} /></div>
                </div>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}
    </>
  );
};
