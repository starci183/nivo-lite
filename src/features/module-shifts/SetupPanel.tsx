"use client";

import { useState, useTransition } from "react";
import { Alert, Badge, Button, CheckboxGroup, EmptyNotice, Input, NumberField, SectionHeader, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import type { BenchData } from "@/lib/module-shifts-view";
import {
  addAvailabilityAction, removeAvailabilityAction, removeCoverageAction, removePositionAction, saveCoverageAction, savePositionAction, saveSettingsAction, saveStaffAction,
  type StaffInput,
} from "./actions";
import { BLOCK_CLASS_NAME, FORM_GRID_CLASS_NAME, LIST_CLASS_NAME, LIST_ITEM_CLASS_NAME, PANEL_CLASS_NAME, ROW_CLASS_NAME, SWATCH_CLASS_NAME } from "./classNames";
import { DAY_LONG, DAY_SHORT, dateOptions, dm, timeOptions, vnd, weekdayOptions } from "./format";

type Props = { readonly data: BenchData; readonly onReload: () => Promise<void> };
const TIMES = timeOptions();
const DAY_OPTIONS = DAY_SHORT.map((d, i) => ({ value: String(i), label: d }));

/** Nhân sự & nhu cầu: positions, staff (roles, wage, hour limits), coverage blocks, availability and the rules. */
export const SetupPanel = ({ data, onReload }: Props) => {
  const t = useT(dict);
  const { setup } = data;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const call = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, done: string, after?: () => void) => start(async () => {
    setError(null); setSaved(null);
    const r = await fn();
    if (!r.ok) setError(r.error);
    else { setSaved(done); after?.(); }
    await onReload();
  });
  const posName = (id: string) => setup.positions.find((p) => p.id === id)?.name ?? "";

  /* positions */
  const [posNew, setPosNew] = useState("");
  /* staff */
  const blank: StaffInput = { name: "", positionIds: [], wage: 0, maxWeek: 48, maxDay: 10, minRest: 10, staffRowId: null, phone: "", telegramChatId: "", zaloUserId: "" };
  const [st, setSt] = useState<StaffInput>(blank);
  /* coverage */
  const [cov, setCov] = useState({ days: ["0", "1", "2", "3", "4"], start: "07:00", end: "12:00", positionId: setup.positions[0]?.id ?? "", min: 1, ideal: 1, peak: false });
  /* availability (manager enters for a person) */
  const [av, setAv] = useState({ staffId: setup.staff[0]?.id ?? "", mode: "weekday" as "weekday" | "date", weekday: "0", date: data.today, start: "07:00", end: "22:00", available: false, note: "" });
  /* rules */
  const [rules, setRules] = useState({ swap: setup.settings.swapNoticeHours, leave: setup.settings.leaveNoticeDays, remind: setup.settings.remindMinutes, noshow: setup.settings.noshowMinutes, ot: setup.settings.overtimeHoursWeek });
  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>(() => Object.fromEntries(DAY_SHORT.map((_, i) => [String(i), setup.settings.openingHours[String(i)] ?? null])));

  const coverByDay = DAY_LONG.map((_, d) => setup.blocks.filter((b) => b.weekday === d));
  const availRows = data.allAvailability.filter((a) => a.status === "approved");

  return (
    <div className={PANEL_CLASS_NAME}>
      {error ? <Alert tone="negative" title={t("errTitle")} description={error} /> : null}
      {saved ? <Alert tone="affirmative" title={saved} /> : null}

      <SurfaceCard label={t("posTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("posHint")}</Text>
          <div className={ROW_CLASS_NAME}>
            {setup.positions.map((p) => (
              <Badge key={p.id} tone="neutral"><i className={SWATCH_CLASS_NAME} style={{ background: p.color }} /> {p.name}
                <button type="button" className="ml-1 text-muted" aria-label={`${t("remove")} ${p.name}`} onClick={() => call(() => removePositionAction(p.id), t("saved"))}>×</button></Badge>
            ))}
            {setup.positions.length === 0 ? <Text size="sm" tone="muted">{t("posNone")}</Text> : null}
          </div>
          <div className={ROW_CLASS_NAME}>
            <Input id="pos-new" name="position" label={t("posName")} value={posNew} onValueChange={setPosNew} />
            <div className="flex items-end"><Button variant="outline" isDisabled={pending || !posNew.trim()} onPress={() => call(() => savePositionAction({ name: posNew }), t("saved"), () => setPosNew(""))}>{t("posAdd")}</Button></div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("staffTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("staffHint")}</Text>
          {setup.staff.length === 0 ? <EmptyNotice message={t("staffNone")} description={t("staffNoneBody")} /> : (
            <div className={LIST_CLASS_NAME}>
              {setup.staff.map((p) => (
                <div key={p.id} className={LIST_ITEM_CLASS_NAME}>
                  <div className="min-w-0">
                    <Text size="sm" weight="semibold">{p.name}{p.active ? "" : ` · ${t("inactive")}`}</Text>
                    <Text size="xs" tone="muted">{`${p.positionIds.map(posName).join(", ") || t("noPosition")} · ${vnd(p.wage)}/h · ${p.maxWeek}h/${t("perWeek")}${p.telegramChatId ? " · Telegram" : ""}${p.zaloUserId ? " · Zalo" : ""}`}</Text>
                  </div>
                  <Button size="sm" variant="outline" onPress={() => setSt({ id: p.id, name: p.name, positionIds: [...p.positionIds], wage: p.wage, maxWeek: p.maxWeek, maxDay: p.maxDay, minRest: p.minRest, staffRowId: p.staffRowId, phone: p.phone ?? "", telegramChatId: p.telegramChatId ?? "", zaloUserId: p.zaloUserId ?? "", active: p.active })}>{t("edit")}</Button>
                </div>
              ))}
            </div>
          )}
          <SectionHeader level={3} title={st.id ? t("staffEdit") : t("staffAdd")} />
          <div className={FORM_GRID_CLASS_NAME}>
            <Input id="st-name" name="name" label={t("fName")} value={st.name} onValueChange={(v) => setSt({ ...st, name: v })} />
            <NumberField label={t("fWage")} name="wage" value={st.wage} minValue={0} step={1000} onValueChange={(v) => setSt({ ...st, wage: v })} />
            <NumberField label={t("fMaxWeek")} name="maxWeek" value={st.maxWeek} minValue={1} maxValue={100} onValueChange={(v) => setSt({ ...st, maxWeek: v })} />
            <NumberField label={t("fMaxDay")} name="maxDay" value={st.maxDay} minValue={1} maxValue={16} onValueChange={(v) => setSt({ ...st, maxDay: v })} />
            <NumberField label={t("fRest")} name="rest" value={st.minRest} minValue={0} maxValue={24} onValueChange={(v) => setSt({ ...st, minRest: v })} />
            <Input id="st-phone" name="phone" label={t("fPhone")} value={st.phone ?? ""} onValueChange={(v) => setSt({ ...st, phone: v })} />
            <Input id="st-tg" name="tg" label={t("fTelegram")} value={st.telegramChatId ?? ""} onValueChange={(v) => setSt({ ...st, telegramChatId: v })} />
            <Input id="st-zalo" name="zalo" label={t("fZalo")} value={st.zaloUserId ?? ""} onValueChange={(v) => setSt({ ...st, zaloUserId: v })} />
            <Select label={t("fLink")} name="link" value={st.staffRowId ?? "none"} options={[{ id: "none", label: t("fLinkNone") }, ...data.staffRows.map((r) => ({ id: r.id, label: r.name }))]} onValueChange={(v) => setSt({ ...st, staffRowId: !v || v === "none" ? null : v })} />
          </div>
          <CheckboxGroup label={t("fPositions")} orientation="horizontal" options={setup.positions.map((p) => ({ value: p.id, label: p.name }))} value={st.positionIds} onValueChange={(v) => setSt({ ...st, positionIds: v })} />
          <div className={ROW_CLASS_NAME}>
            <Button variant="primary" isDisabled={pending || !st.name.trim()} onPress={() => call(() => saveStaffAction(st), t("saved"), () => setSt(blank))}>{st.id ? t("save") : t("staffAddBtn")}</Button>
            {st.id ? <Button variant="ghost" onPress={() => setSt(blank)}>{t("cancel")}</Button> : null}
            {st.id ? <Switch label={t("fActive")} name="active" isSelected={st.active !== false} onSelectedChange={(v) => setSt({ ...st, active: v })} /> : null}
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("covTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("covHint")}</Text>
          {setup.blocks.length === 0 ? <Text size="sm" tone="muted">{t("covNone")}</Text> : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {coverByDay.map((list, d) => (
                <div key={d} className="flex min-w-0 flex-col gap-1 rounded-lg border border-separator p-2">
                  <Text size="xs" weight="semibold">{DAY_LONG[d]}</Text>
                  {list.length === 0 ? <Text size="xs" tone="muted">—</Text> : list.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-1 text-xs">
                      <span className="min-w-0 truncate">{`${b.start}–${b.end} ${posName(b.positionId)} ${b.min}${b.ideal > b.min ? `–${b.ideal}` : ""}${b.peak ? " ★" : ""}`}</span>
                      <button type="button" className="text-muted" aria-label={t("remove")} onClick={() => call(() => removeCoverageAction(b.id), t("saved"))}>×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <SectionHeader level={3} title={t("covAdd")} />
          <CheckboxGroup label={t("covDays")} orientation="horizontal" options={DAY_OPTIONS} value={cov.days} onValueChange={(v) => setCov({ ...cov, days: v })} />
          <div className={FORM_GRID_CLASS_NAME}>
            <Select label={t("fromTime")} name="cstart" value={cov.start} options={TIMES} onValueChange={(v) => v && setCov({ ...cov, start: v })} />
            <Select label={t("toTime")} name="cend" value={cov.end} options={TIMES} onValueChange={(v) => v && setCov({ ...cov, end: v })} />
            <Select label={t("fPosition")} name="cpos" value={cov.positionId} options={setup.positions.map((p) => ({ id: p.id, label: p.name }))} onValueChange={(v) => v && setCov({ ...cov, positionId: v })} />
            <NumberField label={t("covMin")} name="cmin" value={cov.min} minValue={0} maxValue={50} onValueChange={(v) => setCov({ ...cov, min: v, ideal: Math.max(cov.ideal, v) })} />
            <NumberField label={t("covIdeal")} name="cideal" value={cov.ideal} minValue={cov.min} maxValue={50} onValueChange={(v) => setCov({ ...cov, ideal: v })} />
          </div>
          <div className={ROW_CLASS_NAME}>
            <Switch label={t("covPeak")} name="peak" isSelected={cov.peak} onSelectedChange={(v) => setCov({ ...cov, peak: v })} />
            <Button variant="primary" isDisabled={pending || !cov.positionId} onPress={() => call(() => saveCoverageAction({ weekdays: cov.days.map(Number), start: cov.start, end: cov.end, positionId: cov.positionId, min: cov.min, ideal: cov.ideal, peak: cov.peak }), t("saved"))}>{t("covAddBtn")}</Button>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("availMgrTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("availMgrHint")}</Text>
          <div className={FORM_GRID_CLASS_NAME}>
            <Select label={t("fStaff")} name="astaff" value={av.staffId} options={setup.staff.map((p) => ({ id: p.id, label: p.name }))} onValueChange={(v) => v && setAv({ ...av, staffId: v })} />
            <Select label={t("availMode")} name="amode" value={av.mode} options={[{ id: "weekday", label: t("everyWeek") }, { id: "date", label: t("oneDay") }]} onValueChange={(v) => v && setAv({ ...av, mode: v === "date" ? "date" : "weekday" })} />
            {av.mode === "weekday"
              ? <Select label={t("weekday")} name="aweekday" value={av.weekday} options={weekdayOptions} onValueChange={(v) => v && setAv({ ...av, weekday: v })} />
              : <Select label={t("date")} name="adate" value={av.date} options={dateOptions(data.today, 90)} onValueChange={(v) => v && setAv({ ...av, date: v })} />}
            <Select label={t("fromTime")} name="astart" value={av.start} options={TIMES} onValueChange={(v) => v && setAv({ ...av, start: v })} />
            <Select label={t("toTime")} name="aend" value={av.end} options={TIMES} onValueChange={(v) => v && setAv({ ...av, end: v })} />
          </div>
          <div className={ROW_CLASS_NAME}>
            <Switch label={av.available ? t("canWork") : t("cannotWork")} name="aavail" isSelected={av.available} onSelectedChange={(v) => setAv({ ...av, available: v })} />
            <Button variant="outline" isDisabled={pending || !av.staffId} onPress={() => call(() => addAvailabilityAction({ staffId: av.staffId, weekday: av.mode === "weekday" ? Number(av.weekday) : null, date: av.mode === "date" ? av.date : null, start: av.start, end: av.end, available: av.available }), t("saved"))}>{t("availAddBtn")}</Button>
          </div>
          {availRows.length ? (
            <div className={LIST_CLASS_NAME}>
              {availRows.slice(0, 40).map((a) => (
                <div key={a.id} className={LIST_ITEM_CLASS_NAME}>
                  <Text size="sm">{`${setup.staff.find((p) => p.id === a.staffId)?.name ?? "—"}: ${a.available ? t("canWork") : t("cannotWork")} ${a.date ? dm(a.date) : DAY_LONG[a.weekday ?? 0]} ${a.start}–${a.end}`}</Text>
                  <Button size="sm" variant="ghost" onPress={() => call(() => removeAvailabilityAction(a.id), t("saved"))}>{t("remove")}</Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("rulesTitle")} headingLevel={2}>
        <div className={BLOCK_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("rulesHint")}</Text>
          <div className={FORM_GRID_CLASS_NAME}>
            <NumberField label={t("rSwap")} name="rswap" value={rules.swap} minValue={0} maxValue={168} onValueChange={(v) => setRules({ ...rules, swap: v })} />
            <NumberField label={t("rLeave")} name="rleave" value={rules.leave} minValue={0} maxValue={60} onValueChange={(v) => setRules({ ...rules, leave: v })} />
            <NumberField label={t("rRemind")} name="rremind" value={rules.remind} minValue={5} maxValue={1440} onValueChange={(v) => setRules({ ...rules, remind: v })} />
            <NumberField label={t("rNoShow")} name="rnoshow" value={rules.noshow} minValue={1} maxValue={120} onValueChange={(v) => setRules({ ...rules, noshow: v })} />
            <NumberField label={t("rOvertime")} name="rot" value={rules.ot} minValue={1} maxValue={120} onValueChange={(v) => setRules({ ...rules, ot: v })} />
          </div>
          <SectionHeader level={3} title={t("hoursTitle")} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DAY_LONG.map((label, i) => {
              const h = hours[String(i)];
              return (
                <div key={i} className={ROW_CLASS_NAME}>
                  <Switch label={label} name={`open-${i}`} isSelected={h !== null} onSelectedChange={(v) => setHours({ ...hours, [i]: v ? { open: "07:00", close: "22:00" } : null })} />
                  {h ? <>
                    <Select label={t("fromTime")} isLabelHidden name={`o-${i}`} value={h.open} options={TIMES} onValueChange={(v) => v && setHours({ ...hours, [i]: { ...h, open: v } })} />
                    <Select label={t("toTime")} isLabelHidden name={`c-${i}`} value={h.close} options={TIMES} onValueChange={(v) => v && setHours({ ...hours, [i]: { ...h, close: v } })} />
                  </> : <Text size="xs" tone="muted">{t("closedDay")}</Text>}
                </div>
              );
            })}
          </div>
          <div className={ROW_CLASS_NAME}>
            <Button variant="primary" isDisabled={pending} onPress={() => call(() => saveSettingsAction({ swapNoticeHours: rules.swap, leaveNoticeDays: rules.leave, remindMinutes: rules.remind, noshowMinutes: rules.noshow, overtimeHoursWeek: rules.ot, openingHours: hours }), t("saved"))}>{t("save")}</Button>
            <Badge tone={data.reminderOn ? "success" : "neutral"}>{data.reminderOn ? t("reminderOn") : t("reminderOff")}</Badge>
          </div>
          {!data.reminderOn ? <Text size="xs" tone="muted">{t("reminderOffHint")}</Text> : null}
        </div>
      </SurfaceCard>
    </div>
  );
};
