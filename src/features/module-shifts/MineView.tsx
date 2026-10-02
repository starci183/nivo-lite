"use client";

import { useState, useTransition } from "react";
import { Alert, Badge, Button, EmptyNotice, Input, SectionHeader, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import type { ShiftPosition } from "@/lib/module-shifts-types";
import { instantOf, toMin } from "@/lib/module-shifts-types";
import type { MineData } from "@/lib/module-shifts-view";
import { checkInAction, claimShiftAction, submitAvailabilityAction, submitLeaveAction, submitSwapAction } from "./actions";
import { BLOCK_CLASS_NAME, FORM_GRID_CLASS_NAME, LIST_CLASS_NAME, LIST_ITEM_CLASS_NAME, PANEL_CLASS_NAME, ROW_CLASS_NAME } from "./classNames";
import { DAY_LONG, dateOptions, dayFull, dm, timeOptions, weekdayOptions } from "./format";

type Props = { readonly mine: MineData; readonly positions: ReadonlyArray<ShiftPosition>; readonly onReload: () => Promise<void> };
const TIMES = timeOptions();
const stTone = (s: string) => (s === "approved" ? "success" : s === "declined" ? "neutral" : "warning") as "success" | "neutral" | "warning";

/** Lịch của tôi: my shifts (check in, ask to swap), open shifts to ask for, leave and availability requests. */
export const MineView = ({ mine, positions, onReload }: Props) => {
  const t = useT(dict);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [swapTo, setSwapTo] = useState<string | null>(null);
  const [swapWhy, setSwapWhy] = useState("");
  const [from, setFrom] = useState(mine.today);
  const [to, setTo] = useState(mine.today);
  const [why, setWhy] = useState("");
  const [av, setAv] = useState({ mode: "weekday" as "weekday" | "date", weekday: "0", date: mine.today, start: "07:00", end: "22:00", available: true, note: "" });
  const pos = (id: string) => positions.find((p) => p.id === id);
  const dates = dateOptions(mine.today, 90);

  const act = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, okText: (d: never) => string, after?: () => void) => start(async () => {
    setError(null); setNotice(null);
    const r = await fn();
    if (!r.ok) setError(r.error);
    else { setNotice(okText(r.data as never)); after?.(); }
    await onReload();
  });

  const canCheckIn = (s: { date: string; start: string; end: string }) => {
    const now = Date.now();
    return now >= instantOf(s.date, toMin(s.start)).getTime() - 30 * 60_000 && now <= instantOf(s.date, toMin(s.end)).getTime();
  };
  const name = (id: string | null) => (id ? mine.colleagues.find((c) => c.id === id)?.name : null);

  if (!mine.profileId) return <EmptyNotice message={t("noProfileTitle")} description={t("noProfileBody")} />;

  return (
    <div className={PANEL_CLASS_NAME}>
      {error ? <Alert tone="negative" title={t("errTitle")} description={error} /> : null}
      {notice ? <Alert tone="affirmative" title={notice} /> : null}

      <section className={BLOCK_CLASS_NAME}>
        <SectionHeader level={2} title={t("mineUpcoming")} description={t("mineUpcomingHint")} />
        {mine.myShifts.length === 0 ? <EmptyNotice message={t("mineNone")} description={t("mineNoneBody")} /> : (
          <div className={LIST_CLASS_NAME}>
            {mine.myShifts.map((s) => (
              <div key={s.id} className="flex min-w-0 flex-col gap-2 py-3">
                <div className={LIST_ITEM_CLASS_NAME}>
                  <div className="min-w-0">
                    <Text size="sm" weight="semibold">{`${dayFull(s.date)} · ${s.start}–${s.end}`}</Text>
                    <Text size="xs" tone="muted">{pos(s.positionId)?.name ?? ""}{s.status === "swapped" ? ` · ${t("swappedTag")}` : ""}</Text>
                  </div>
                  <div className={ROW_CLASS_NAME}>
                    {s.checkedIn ? <Badge tone="success">{t("checkedIn")}</Badge> : s.date === mine.today ? (
                      <Button size="sm" variant="primary" isDisabled={pending || !canCheckIn(s)} onPress={() => act(() => checkInAction(s.id), () => t("checkedInOk"))}>{t("checkIn")}</Button>
                    ) : null}
                    <Button size="sm" variant="outline" isDisabled={pending} onPress={() => { setSwapFor(swapFor === s.id ? null : s.id); setSwapTo(null); setSwapWhy(""); }}>{t("askSwap")}</Button>
                  </div>
                </div>
                {swapFor === s.id ? (
                  <div className={FORM_GRID_CLASS_NAME}>
                    <Select label={t("swapWith")} name={`swap-${s.id}`} value={swapTo} placeholder={t("pickPerson")}
                      options={mine.colleagues.filter((c) => c.positionIds.includes(s.positionId)).map((c) => ({ id: c.id, label: c.name }))} onValueChange={setSwapTo} />
                    <Input id={`swap-why-${s.id}`} name="reason" label={t("reason")} value={swapWhy} onValueChange={setSwapWhy} />
                    <div className="flex items-end">
                      <Button variant="primary" isDisabled={pending || !swapTo} onPress={() => act(() => submitSwapAction({ shiftId: s.id, toStaffId: swapTo!, reason: swapWhy }), (d: { summary: string }) => d.summary, () => setSwapFor(null))}>{t("sendRequest")}</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={BLOCK_CLASS_NAME}>
        <SectionHeader level={2} title={t("openShifts")} description={t("openShiftsHint")} />
        {mine.openShifts.length === 0 ? <Text size="sm" tone="muted">{t("openNone")}</Text> : (
          <div className={LIST_CLASS_NAME}>
            {mine.openShifts.map((s) => (
              <div key={s.id} className={LIST_ITEM_CLASS_NAME}>
                <div className="min-w-0"><Text size="sm" weight="semibold">{`${dayFull(s.date)} · ${s.start}–${s.end}`}</Text><Text size="xs" tone="muted">{pos(s.positionId)?.name ?? ""}</Text></div>
                <Button size="sm" variant="outline" isDisabled={pending} onPress={() => act(() => claimShiftAction(s.id), (d: { summary: string }) => d.summary)}>{t("claim")}</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <SurfaceCard label={t("leaveTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("leaveHint")}</Text>
          <div className={FORM_GRID_CLASS_NAME}>
            <Select label={t("fromDate")} name="from" value={from} options={dates} onValueChange={(v) => { if (v) { setFrom(v); if (to < v) setTo(v); } }} />
            <Select label={t("toDate")} name="to" value={to} options={dates.filter((d) => d.id >= from)} onValueChange={(v) => v && setTo(v)} />
            <Input id="leave-why" name="reason" label={t("reason")} value={why} onValueChange={setWhy} />
            <div className="flex items-end"><Button variant="primary" isDisabled={pending} onPress={() => act(() => submitLeaveAction({ from, to, reason: why }), (d: { summary: string }) => d.summary, () => setWhy(""))}>{t("sendLeave")}</Button></div>
          </div>
          {mine.leaves.length ? (
            <div className={LIST_CLASS_NAME}>
              {mine.leaves.slice(0, 6).map((l) => (
                <div key={l.id} className={LIST_ITEM_CLASS_NAME}><Text size="sm">{`${dm(l.from)}${l.to !== l.from ? ` – ${dm(l.to)}` : ""}${l.reason ? ` · ${l.reason}` : ""}`}</Text><Badge tone={stTone(l.status)}>{t(l.status === "approved" ? "stApproved" : l.status === "declined" ? "stDeclined" : "stPending")}</Badge></div>
              ))}
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("availTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("availHint")}</Text>
          <div className={FORM_GRID_CLASS_NAME}>
            <Select label={t("availMode")} name="mode" value={av.mode} options={[{ id: "weekday", label: t("everyWeek") }, { id: "date", label: t("oneDay") }]} onValueChange={(v) => v && setAv({ ...av, mode: v === "date" ? "date" : "weekday" })} />
            {av.mode === "weekday"
              ? <Select label={t("weekday")} name="weekday" value={av.weekday} options={weekdayOptions} onValueChange={(v) => v && setAv({ ...av, weekday: v })} />
              : <Select label={t("date")} name="date" value={av.date} options={dates} onValueChange={(v) => v && setAv({ ...av, date: v })} />}
            <Select label={t("fromTime")} name="start" value={av.start} options={TIMES} onValueChange={(v) => v && setAv({ ...av, start: v })} />
            <Select label={t("toTime")} name="end" value={av.end} options={TIMES} onValueChange={(v) => v && setAv({ ...av, end: v })} />
          </div>
          <div className={ROW_CLASS_NAME}>
            <Switch label={av.available ? t("canWork") : t("cannotWork")} name="available" isSelected={av.available} onSelectedChange={(v) => setAv({ ...av, available: v })} />
            <Input id="av-note" name="note" label={t("note")} value={av.note} onValueChange={(v) => setAv({ ...av, note: v })} />
            <Button variant="primary" isDisabled={pending} onPress={() => act(() => submitAvailabilityAction({ weekday: av.mode === "weekday" ? Number(av.weekday) : null, date: av.mode === "date" ? av.date : null, start: av.start, end: av.end, available: av.available, note: av.note }), () => t("availSent"))}>{t("sendAvail")}</Button>
          </div>
          {mine.availability.length ? (
            <div className={LIST_CLASS_NAME}>
              {mine.availability.slice(0, 10).map((a) => (
                <div key={a.id} className={LIST_ITEM_CLASS_NAME}>
                  <Text size="sm">{`${a.available ? t("canWork") : t("cannotWork")} ${a.date ? dm(a.date) : DAY_LONG[a.weekday ?? 0]} ${a.start}–${a.end}`}</Text>
                  <Badge tone={stTone(a.status)}>{t(a.status === "approved" ? "stApproved" : a.status === "declined" ? "stDeclined" : "stPending")}</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      {mine.swaps.length ? (
        <section className={BLOCK_CLASS_NAME}>
          <SectionHeader level={2} title={t("mySwaps")} />
          <div className={LIST_CLASS_NAME}>
            {mine.swaps.slice(0, 8).map((s) => (
              <div key={s.id} className={LIST_ITEM_CLASS_NAME}>
                <Text size="sm">{s.kind === "claim" ? t("claimLine", { name: name(s.toStaffId) ?? t("you"), shift: s.shiftLine }) : t("swapLine", { from: name(s.fromStaffId) ?? t("you"), to: name(s.toStaffId) ?? t("you"), shift: s.shiftLine })}</Text>
                <Badge tone={stTone(s.status)}>{t(s.status === "approved" ? "stApproved" : s.status === "declined" ? "stDeclined" : "stPending")}</Badge>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
