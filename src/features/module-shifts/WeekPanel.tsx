"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Badge, Button, DescriptionList, EmptyNotice, HorizontalScrollRegion, ListItem, Meter, Region, SectionHeader, Select, SurfaceCard, SurfaceListCard, Tabs, Text, type PresentationState } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import type { BenchData } from "@/lib/module-shifts-view";
import {
  addDays, coverageOf, laborCost, minutesOf, onDate, segOf, violationsOfShifts, weekDates, type CoverageCell, type Env, type Seg, type Shift, type Violation,
} from "@/lib/module-shifts-types";
import { decideWorkAction, explainScheduleAction, proposeWeekAction, publishScheduleAction, reassignShiftAction } from "./actions";
import {
  BLOCK_CLASS_NAME, CARD_ROW_STACK_CLASS_NAME, CHIP_BROKEN_CLASS_NAME, CHIP_CLASS_NAME, CHIP_OPEN_CLASS_NAME, CHIP_PICKED_CLASS_NAME, COVERAGE_CLASS_NAME, DAYLIST_CLASS_NAME,
  GRID_CELL_CLASS_NAME, GRID_CELL_OFF_CLASS_NAME, GRID_CELL_TARGET_CLASS_NAME, GRID_CLASS_NAME, GRID_FRAME_CLASS_NAME, GRID_HEAD_CLASS_NAME, GRID_NAME_CLASS_NAME,
  PANEL_CLASS_NAME, ROW_CLASS_NAME, ROW_END_CLASS_NAME,
} from "./classNames";
import { dayName, dm, hrs, vnd, weekRange } from "./format";

type Props = { readonly data: BenchData; readonly canManage: boolean; readonly onReload: (monday?: string) => Promise<void> };

const VIOLATION_KEYS: Record<Violation["kind"], "vOverlap" | "vUnavailable" | "vLeave" | "vMaxDay" | "vMaxWeek" | "vRest" | "vPosition"> = {
  overlap: "vOverlap", unavailable: "vUnavailable", leave: "vLeave", max_day: "vMaxDay", max_week: "vMaxWeek", rest: "vRest", position: "vPosition",
};

/** Lịch tuần: week navigation, the solver proposal, coverage, the people x days grid (drag or click to reassign), and the publish gate. */
export const WeekPanel = ({ data, canManage, onReload }: Props) => {
  const t = useT(dict);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<null | "propose" | "explain" | "publish" | "decide">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warn, setWarn] = useState<ReadonlyArray<string>>([]);
  const [run, setRun] = useState<{ ms: number; iterations: number } | null>(null);
  const [moves, setMoves] = useState<Record<string, string | null>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState(0);

  const { setup, week } = data;
  const sched = week.current;
  const draft = sched?.status === "draft";
  const editable = canManage && draft;
  const dates = weekDates(week.monday);
  const shifts: ReadonlyArray<Shift> = useMemo(() => week.shifts.map((s) => (s.id in moves ? { ...s, staffId: moves[s.id] } : s)), [week.shifts, moves]);
  const env: Env = useMemo(() => ({
    staff: new Map(setup.staff.map((p) => [p.id, p])), avail: week.approvedAvail, leaves: week.approvedLeaves,
    prior: new Map(Object.entries(week.prior) as Array<[string, ReadonlyArray<Seg>]>), overtimeHoursWeek: setup.settings.overtimeHoursWeek,
  }), [setup, week]);
  const broken = useMemo(() => violationsOfShifts(env, shifts), [env, shifts]);
  const cells = useMemo(() => coverageOf(setup.blocks, week.monday, shifts), [setup.blocks, week.monday, shifts]);
  const cost = useMemo(() => laborCost(env, shifts), [env, shifts]);
  const posOf = (id: string) => setup.positions.find((p) => p.id === id);
  const staffName = (id: string | null) => (id ? setup.staff.find((p) => p.id === id)?.name ?? "—" : t("openShift"));
  const short = cells.filter((c) => c.status === "short").length;
  const open = shifts.filter((s) => !s.staffId).length;

  const fail = (e: string) => { setError(e); setNotice(null); };
  const go = (monday: string) => { setMoves({}); setPicked(null); setRun(null); start(() => { void onReload(monday); }); };

  const propose = () => start(async () => {
    setError(null); setNotice(null); setBusy("propose");
    const r = await proposeWeekAction(week.monday);
    if (!r.ok) { setBusy(null); return fail(r.error); }
    setRun({ ms: r.data.ms, iterations: r.data.iterations });
    setMoves({});
    await onReload(week.monday);
    setBusy("explain");
    const x = await explainScheduleAction(r.data.scheduleId);
    if (!x.ok) fail(x.error);
    await onReload(week.monday);
    setBusy(null);
  });

  const publish = () => start(async () => {
    if (!sched) return;
    setError(null); setNotice(null); setBusy("publish");
    const r = await publishScheduleAction(sched.id);
    if (!r.ok) fail(r.error);
    else setNotice(r.data.status === "done" ? t("publishedNow") : t("publishAsked"));
    await onReload(week.monday);
    setBusy(null);
  });

  const decide = (decision: "approved" | "rejected") => start(async () => {
    if (!week.publishItem) return;
    setError(null); setNotice(null); setBusy("decide");
    const r = await decideWorkAction(week.publishItem.id, decision);
    if (!r.ok) fail(r.error);
    else setNotice(r.data.summary);
    await onReload(week.monday);
    setBusy(null);
  });

  const move = (shiftId: string, staffId: string | null) => {
    const cur = shifts.find((s) => s.id === shiftId);
    setPicked(null); setOver(null);
    if (!cur || cur.staffId === staffId) return;
    setMoves((m) => ({ ...m, [shiftId]: staffId }));
    start(async () => {
      setError(null);
      const r = await reassignShiftAction(shiftId, staffId);
      if (!r.ok) { setMoves((m) => { const n = { ...m }; delete n[shiftId]; return n; }); return fail(r.error); }
      setWarn(r.data.warnings);
      await onReload(week.monday);
      setMoves({});
    });
  };

  const chip = (s: Shift) => {
    const p = posOf(s.positionId);
    const v = broken.get(s.id);
    const label = `${s.start}–${s.end}`;
    const why = v?.map((x) => t(VIOLATION_KEYS[x.kind])).join(", ");
    // grammar gap: a drag source / pick target (see CHIP_CLASS_NAME); the leading edge carries the position colour (workspace data).
    return (
      <button
        key={s.id} type="button" draggable={editable} disabled={!editable}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); setPicked(s.id); }}
        onDragEnd={() => { setPicked(null); setOver(null); }}
        onClick={(e) => { e.stopPropagation(); if (editable) setPicked(picked === s.id ? null : s.id); }}
        title={why ? `${t("breaks")}: ${why}` : undefined}
        aria-label={`${label} ${p?.name ?? ""} ${why ? `, ${t("breaks")}: ${why}` : ""}`}
        className={[CHIP_CLASS_NAME, picked === s.id ? CHIP_PICKED_CLASS_NAME : "", v ? CHIP_BROKEN_CLASS_NAME : "", s.staffId ? "" : CHIP_OPEN_CLASS_NAME].join(" ")}
        style={{ borderLeftColor: p?.color ?? "var(--border)" }}
      >
        <Text as="span" size="xs" weight="medium">{label}</Text>
        <Text as="span" size="xs" tone="muted" overflow="truncate">{`${p?.name ?? ""}${v ? " ⚠" : ""}`}</Text>
      </button>
    );
  };

  const rows: Array<{ id: string | null; name: string; sub: string }> = [
    ...setup.staff.filter((p) => p.active).map((p) => {
      const mine = shifts.filter((s) => s.staffId === p.id).map(segOf);
      const mins = minutesOf(mine);
      return { id: p.id, name: p.name, sub: `${hrs(mins)}/${p.maxWeek}h${canManage && p.wage ? ` · ${vnd(cost.byStaff.get(p.id)?.cost ?? 0)}` : ""}` };
    }),
    { id: null, name: t("openShift"), sub: open ? t("openCount", { n: open }) : "" },
  ];

  const status = !sched ? <Badge tone="neutral">{t("noSchedule")}</Badge> : draft ? <Badge tone="warning">{t("draftN", { n: sched.version })}</Badge> : <Badge tone="success">{t("publishedN", { n: sched.version })}</Badge>;
  const explain = sched?.explanation?.trim();
  const expSource = (sched?.evidence as { explanation?: { source?: string } } | undefined)?.explanation?.source;
  const waiting = week.publishItem?.status === "waiting_decision";

  const coverageOfDay = (date: string): Array<CoverageCell> => cells.filter((c) => c.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const coverTone = (c: CoverageCell): PresentationState => (c.status === "short" ? "negative" : c.status === "over" ? "cautionary" : "affirmative");
  const coverReading = (c: CoverageCell): string => `${c.have}/${c.min}${c.ideal > c.min ? `–${c.ideal}` : ""} ${c.status === "short" ? t("cShort") : c.status === "over" ? t("cOver") : t("cOk")}`;
  const explainLines = explain ? explain.split("\n").filter((x) => x.trim()) : [];
  const dayShifts = onDate(shifts, dates[dayIdx]);

  return (
    <div className={PANEL_CLASS_NAME}>
      <div className={ROW_END_CLASS_NAME}>
        <div className={ROW_CLASS_NAME}>
          <Button variant="outline" size="sm" onPress={() => go(addDays(week.monday, -7))} isDisabled={pending}>{t("prevWeek")}</Button>
          <Text size="md" weight="semibold">{t("weekOf", { range: weekRange(week.monday) })}</Text>
          <Button variant="outline" size="sm" onPress={() => go(addDays(week.monday, 7))} isDisabled={pending}>{t("nextWeek")}</Button>
          <Button variant="ghost" size="sm" onPress={() => go(data.today)} isDisabled={pending}>{t("thisWeek")}</Button>
          {status}
        </div>
        {canManage ? (
          <div className={ROW_CLASS_NAME}>
            <Button variant={draft ? "outline" : "primary"} onPress={propose} isPending={busy === "propose" || busy === "explain"} isDisabled={pending && busy === null}>{t("propose")}</Button>
            {draft && !waiting ? <Button variant="primary" onPress={publish} isPending={busy === "publish"} isDisabled={pending && busy === null}>{t("publish")}</Button> : null}
          </div>
        ) : null}
      </div>

      {error ? <Alert tone="negative" title={t("errTitle")} description={error} /> : null}
      {notice ? <Alert tone="affirmative" title={notice} /> : null}
      {warn.length ? <Alert tone="cautionary" title={t("moveWarn")} description={warn.join("; ")} /> : null}
      {busy === "propose" ? <Text size="sm" tone="muted" live="polite">{t("solving")}</Text> : null}
      {busy === "explain" ? <Text size="sm" tone="muted" live="polite">{t("explaining")}</Text> : null}
      {run ? <Text size="xs" tone="muted">{t("solverTook", { ms: run.ms, n: run.iterations })}</Text> : null}

      {waiting && week.publishItem ? (
        <div className={BLOCK_CLASS_NAME}>
          <Alert tone="informative" title={t("waitingTitle")} description={week.publishItem.summary} />
          {canManage ? (
            <div className={ROW_CLASS_NAME}>
              <Button variant="primary" size="sm" onPress={() => decide("approved")} isPending={busy === "decide"}>{t("approvePublish")}</Button>
              <Button variant="outline" size="sm" onPress={() => decide("rejected")} isDisabled={busy === "decide"}>{t("declinePublish")}</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!sched ? (
        <EmptyNotice message={t("noScheduleTitle")} description={setup.blocks.length && setup.staff.length ? t("noScheduleBody") : t("needSetup")} />
      ) : (
        <>
          <SurfaceCard ariaLabel={t("weekOf", { range: weekRange(week.monday) })}>
            <DescriptionList
              layout="stat-strip"
              isDivided
              items={[
                { id: "cost", term: t("mCost"), description: vnd(cost.total), meta: t("mCostHint") },
                { id: "shifts", term: t("mShifts"), description: String(shifts.length - open), meta: open ? t("openCount", { n: open }) : t("noOpen") },
                { id: "short", term: t("mShort"), description: short > 0 ? <Badge tone="danger" isDot>{String(short)}</Badge> : String(short), meta: t("mShortHint") },
                { id: "broken", term: t("mBroken"), description: broken.size > 0 ? <Badge tone="danger" isDot>{String(broken.size)}</Badge> : String(broken.size), meta: t("mBrokenHint") },
              ]}
            />
          </SurfaceCard>

          {canManage && (explain || draft) ? (
            <SurfaceCard label={t("explainTitle")} headingLevel={2} labelEnd={explain ? <Badge tone={expSource === "openclaw" ? "accent" : "neutral"}>{expSource === "openclaw" ? t("byOpenClaw") : t("autoSummary")}</Badge> : null}>
              {explain ? (
                <div className={BLOCK_CLASS_NAME}>{explainLines.map((line, i) => <Text key={i} size="sm">{line}</Text>)}</div>
              ) : <Text size="sm" tone="muted">{t("explainNone")}</Text>}
            </SurfaceCard>
          ) : null}

          {canManage && setup.blocks.length ? (
            <Region label={t("coverageTitle")}>
              <div className={BLOCK_CLASS_NAME}>
                <SectionHeader level={2} title={t("coverageTitle")} description={t("coverageHint")} />
                <div className={COVERAGE_CLASS_NAME}>
                  {dates.map((d) => (
                    <SurfaceCard key={d} label={`${dayName(d)} ${dm(d)}`} headingLevel={3}>
                      <div className={BLOCK_CLASS_NAME}>
                        {coverageOfDay(d).map((c) => (
                          <Meter
                            key={c.blockId} label={`${posOf(c.positionId)?.name ?? ""} ${c.start.slice(0, 2)}–${c.end.slice(0, 2)}h${c.peak ? " ★" : ""}`}
                            value={Math.min(c.have, Math.max(1, c.ideal))} maxValue={Math.max(1, c.ideal)} valueLabel={coverReading(c)} tone={coverTone(c)}
                          />
                        ))}
                      </div>
                    </SurfaceCard>
                  ))}
                </div>
              </div>
            </Region>
          ) : null}

          <Region label={t("gridTitle")}>
            <div className={BLOCK_CLASS_NAME}>
              <SectionHeader level={2} title={t("gridTitle")} description={editable ? t("gridHintEdit") : t("gridHintView")} />
              <div className={GRID_FRAME_CLASS_NAME}>
                <SurfaceCard ariaLabel={t("gridTitle")} composition="joined">
                  <HorizontalScrollRegion overflow="needed" aria-label={t("gridTitle")}>
                    <div className={GRID_CLASS_NAME} role="grid" aria-label={t("gridTitle")}>
                      <div className={GRID_HEAD_CLASS_NAME} />
                      {dates.map((d) => <div key={d} className={GRID_HEAD_CLASS_NAME} role="columnheader"><Text as="span" size="xs" weight="medium">{`${dayName(d)} ${dm(d)}`}</Text></div>)}
                      {rows.map((r) => (
                        <RowCells key={r.id ?? "open"} row={r} dates={dates} shifts={shifts} chip={chip} editable={editable} picked={picked} over={over} setOver={setOver} move={move} leaves={week.approvedLeaves} />
                      ))}
                    </div>
                  </HorizontalScrollRegion>
                </SurfaceCard>
              </div>
              <div className={DAYLIST_CLASS_NAME}>
                <Tabs label={t("gridTitle")} selectedKey={dates[dayIdx]} inset="none" labelVisibility="always" items={dates.map((d) => ({ id: d, label: `${dayName(d)} ${dm(d)}` }))} onSelect={(k) => setDayIdx(Math.max(0, dates.indexOf(k)))} />
                <SurfaceListCard ariaLabel={`${dayName(dates[dayIdx])} ${dm(dates[dayIdx])}`} isVerdict empty={<EmptyNotice message={t("noShiftsDay")} />}>
                  {dayShifts.map((s) => {
                    const v = broken.get(s.id);
                    return (
                      <ListItem key={s.id} className={CARD_ROW_STACK_CLASS_NAME} data-verdict={v ? "danger" : undefined}>
                        <Text size="sm" weight="medium">{`${s.start}–${s.end} · ${posOf(s.positionId)?.name ?? ""}`}</Text>
                        {editable ? (
                          <Select
                            label={t("assignTo")} isLabelHidden name={`assign-${s.id}`} variant="secondary" value={s.staffId ?? "open"}
                            options={[{ id: "open", label: t("openShift") }, ...setup.staff.filter((p) => p.active).map((p) => ({ id: p.id, label: p.name }))]}
                            onValueChange={(val) => move(s.id, !val || val === "open" ? null : val)}
                          />
                        ) : <Text size="sm">{staffName(s.staffId)}</Text>}
                        {v ? <Text size="xs" tone="muted">{`${t("breaks")}: ${v.map((x) => t(VIOLATION_KEYS[x.kind])).join(", ")}`}</Text> : null}
                      </ListItem>
                    );
                  })}
                </SurfaceListCard>
              </div>
            </div>
          </Region>
        </>
      )}
    </div>
  );
};

type RowProps = {
  readonly row: { id: string | null; name: string; sub: string }; readonly dates: ReadonlyArray<string>; readonly shifts: ReadonlyArray<Shift>;
  readonly chip: (s: Shift) => React.ReactNode; readonly editable: boolean; readonly picked: string | null; readonly over: string | null;
  readonly setOver: (k: string | null) => void; readonly move: (shiftId: string, staffId: string | null) => void;
  readonly leaves: ReadonlyArray<{ staffId: string; from: string; to: string }>;
};

const RowCells = ({ row, dates, shifts, chip, editable, picked, over, setOver, move, leaves }: RowProps) => (
  <>
    <div className={GRID_NAME_CLASS_NAME} role="rowheader"><Text size="sm" weight="medium">{row.name}</Text><Text size="xs" tone="muted">{row.sub}</Text></div>
    {dates.map((d) => {
      const key = `${row.id ?? "open"}|${d}`;
      const here = shifts.filter((s) => s.staffId === row.id && s.date === d).sort((a, b) => a.start.localeCompare(b.start));
      const pickedShift = picked ? shifts.find((s) => s.id === picked) : null;
      const canDrop = editable && !!pickedShift && pickedShift.date === d;
      const onLeaveToday = row.id !== null && leaves.some((l) => l.staffId === row.id && l.from <= d && l.to >= d);
      return (
        <div
          key={key} role="gridcell"
          className={[GRID_CELL_CLASS_NAME, over === key && canDrop ? GRID_CELL_TARGET_CLASS_NAME : "", onLeaveToday ? GRID_CELL_OFF_CLASS_NAME : ""].join(" ")}
          onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOver(key); } }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, row.id); }}
          onClick={() => { if (canDrop && picked) move(picked, row.id); }}
        >
          {here.map(chip)}
          {onLeaveToday && !here.length ? <Text as="span" size="xs" tone="muted">Nghỉ phép</Text> : null}
        </div>
      );
    })}
  </>
);
