"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Badge, Button, EmptyNotice, SectionHeader, Select, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import type { BenchData } from "@/lib/module-shifts-view";
import {
  addDays, coverageOf, laborCost, minutesOf, onDate, segOf, violationsOfShifts, weekDates, type CoverageCell, type Env, type Seg, type Shift, type Violation,
} from "@/lib/module-shifts-types";
import { decideWorkAction, explainScheduleAction, proposeWeekAction, publishScheduleAction, reassignShiftAction } from "./actions";
import {
  BLOCK_CLASS_NAME, CHIP_BROKEN_CLASS_NAME, CHIP_CLASS_NAME, CHIP_OPEN_CLASS_NAME, CHIP_PICKED_CLASS_NAME, COVERAGE_CLASS_NAME, COVERAGE_DAY_CLASS_NAME, COVER_BAR_CLASS_NAME,
  COVER_ROW_CLASS_NAME, DAYLIST_CLASS_NAME, DAYTABS_CLASS_NAME, DAY_PILL_CLASS_NAME, DAY_PILL_ON_CLASS_NAME, GRID_CELL_CLASS_NAME, GRID_CELL_OFF_CLASS_NAME, GRID_CELL_TARGET_CLASS_NAME,
  GRID_CLASS_NAME, GRID_FRAME_CLASS_NAME, GRID_HEAD_CLASS_NAME, GRID_NAME_CLASS_NAME, MEASURES_CLASS_NAME, MEASURE_CLASS_NAME, MEASURE_VALUE_CLASS_NAME, NOTE_CLASS_NAME,
  PANEL_CLASS_NAME, ROW_CLASS_NAME, ROW_END_CLASS_NAME, SWATCH_CLASS_NAME,
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
    return (
      <button
        key={s.id} type="button" draggable={editable} disabled={!editable}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); setPicked(s.id); }}
        onDragEnd={() => { setPicked(null); setOver(null); }}
        onClick={(e) => { e.stopPropagation(); if (editable) setPicked(picked === s.id ? null : s.id); }}
        title={why ? `${t("breaks")}: ${why}` : undefined}
        aria-label={`${label} ${p?.name ?? ""} ${why ? `, ${t("breaks")}: ${why}` : ""}`}
        className={[CHIP_CLASS_NAME, picked === s.id ? CHIP_PICKED_CLASS_NAME : "", v ? CHIP_BROKEN_CLASS_NAME : "", s.staffId ? "" : CHIP_OPEN_CLASS_NAME].join(" ")}
        style={{ borderLeft: `4px solid ${p?.color ?? "#999"}` }}
      >
        <span className="font-medium tabular-nums">{label}</span>
        <span className="truncate text-muted">{p?.name}{v ? " ⚠" : ""}</span>
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
  const coverBar = (c: CoverageCell) => {
    const pct = Math.min(100, Math.round((c.have / Math.max(1, c.ideal)) * 100));
    const color = c.status === "short" ? "bg-danger" : c.status === "over" ? "bg-warning" : "bg-success";
    return <div className={COVER_BAR_CLASS_NAME} aria-hidden><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>;
  };

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
          <div className={MEASURES_CLASS_NAME}>
            <div className={MEASURE_CLASS_NAME}><Text size="xs" tone="muted">{t("mCost")}</Text><p className={MEASURE_VALUE_CLASS_NAME}>{vnd(cost.total)}</p><Text size="xs" tone="muted">{t("mCostHint")}</Text></div>
            <div className={MEASURE_CLASS_NAME}><Text size="xs" tone="muted">{t("mShifts")}</Text><p className={MEASURE_VALUE_CLASS_NAME}>{shifts.length - open}</p><Text size="xs" tone="muted">{open ? t("openCount", { n: open }) : t("noOpen")}</Text></div>
            <div className={MEASURE_CLASS_NAME}><Text size="xs" tone="muted">{t("mShort")}</Text><p className={MEASURE_VALUE_CLASS_NAME}>{short}</p><Text size="xs" tone="muted">{t("mShortHint")}</Text></div>
            <div className={MEASURE_CLASS_NAME}><Text size="xs" tone="muted">{t("mBroken")}</Text><p className={MEASURE_VALUE_CLASS_NAME}>{broken.size}</p><Text size="xs" tone="muted">{t("mBrokenHint")}</Text></div>
          </div>

          {canManage && (explain || draft) ? (
            <SurfaceCard label={t("explainTitle")} headingLevel={2} labelEnd={explain ? <Badge tone={expSource === "openclaw" ? "accent" : "neutral"}>{expSource === "openclaw" ? t("byOpenClaw") : t("autoSummary")}</Badge> : null}>
              {explain ? <p className={NOTE_CLASS_NAME}>{explain}</p> : <Text size="sm" tone="muted">{t("explainNone")}</Text>}
            </SurfaceCard>
          ) : null}

          {canManage && setup.blocks.length ? (
            <section className={BLOCK_CLASS_NAME} aria-label={t("coverageTitle")}>
              <SectionHeader level={2} title={t("coverageTitle")} description={t("coverageHint")} />
              <div className={COVERAGE_CLASS_NAME}>
                {dates.map((d) => (
                  <div key={d} className={COVERAGE_DAY_CLASS_NAME}>
                    <Text size="xs" weight="semibold">{`${dayName(d)} ${dm(d)}`}</Text>
                    {coverageOfDay(d).map((c) => (
                      <div key={c.blockId} className={COVER_ROW_CLASS_NAME}>
                        <span className="flex min-w-0 items-center gap-1 text-xs"><i className={SWATCH_CLASS_NAME} style={{ background: posOf(c.positionId)?.color }} /><span className="truncate">{`${posOf(c.positionId)?.name ?? ""} ${c.start.slice(0, 2)}–${c.end.slice(0, 2)}h${c.peak ? " ★" : ""}`}</span></span>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">{coverBar(c)}</div>
                          <span className={`whitespace-nowrap text-xs font-medium tabular-nums ${c.status === "short" ? "text-danger" : c.status === "over" ? "text-warning" : "text-muted"}`}>{`${c.have}/${c.min}${c.ideal > c.min ? `–${c.ideal}` : ""} ${c.status === "short" ? t("cShort") : c.status === "over" ? t("cOver") : t("cOk")}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className={BLOCK_CLASS_NAME} aria-label={t("gridTitle")}>
            <SectionHeader level={2} title={t("gridTitle")} description={editable ? t("gridHintEdit") : t("gridHintView")} />
            <div className={GRID_FRAME_CLASS_NAME} role="grid" aria-label={t("gridTitle")}>
              <div className={GRID_CLASS_NAME}>
                <div className={GRID_HEAD_CLASS_NAME} />
                {dates.map((d) => <div key={d} className={GRID_HEAD_CLASS_NAME}>{`${dayName(d)} ${dm(d)}`}</div>)}
                {rows.map((r) => (
                  <RowCells key={r.id ?? "open"} row={r} dates={dates} shifts={shifts} chip={chip} editable={editable} picked={picked} over={over} setOver={setOver} move={move} leaves={week.approvedLeaves} />
                ))}
              </div>
            </div>
            <div className={DAYLIST_CLASS_NAME}>
              <div className={DAYTABS_CLASS_NAME} role="tablist">
                {dates.map((d, i) => (
                  <button key={d} type="button" role="tab" aria-selected={i === dayIdx} onClick={() => setDayIdx(i)} className={`${DAY_PILL_CLASS_NAME} ${i === dayIdx ? DAY_PILL_ON_CLASS_NAME : ""}`}>
                    <span>{dayName(d)}</span><span className="text-muted">{dm(d)}</span>
                  </button>
                ))}
              </div>
              {onDate(shifts, dates[dayIdx]).length === 0 ? <Text size="sm" tone="muted">{t("noShiftsDay")}</Text> : onDate(shifts, dates[dayIdx]).map((s) => (
                <div key={s.id} className={`${CHIP_CLASS_NAME} ${broken.get(s.id) ? CHIP_BROKEN_CLASS_NAME : ""}`} style={{ borderLeft: `4px solid ${posOf(s.positionId)?.color ?? "#999"}` }}>
                  <span className="text-sm font-medium tabular-nums">{`${s.start}–${s.end} · ${posOf(s.positionId)?.name ?? ""}`}</span>
                  {editable ? (
                    <Select
                      label={t("assignTo")} isLabelHidden name={`assign-${s.id}`} value={s.staffId ?? "open"}
                      options={[{ id: "open", label: t("openShift") }, ...setup.staff.filter((p) => p.active).map((p) => ({ id: p.id, label: p.name }))]}
                      onValueChange={(v) => move(s.id, !v || v === "open" ? null : v)}
                    />
                  ) : <Text size="sm">{staffName(s.staffId)}</Text>}
                  {broken.get(s.id) ? <Text size="xs" tone="muted">{`${t("breaks")}: ${broken.get(s.id)!.map((x) => t(VIOLATION_KEYS[x.kind])).join(", ")}`}</Text> : null}
                </div>
              ))}
            </div>
          </section>
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
          {onLeaveToday && !here.length ? <span className="text-xs text-muted">Nghỉ phép</span> : null}
        </div>
      );
    })}
  </>
);
