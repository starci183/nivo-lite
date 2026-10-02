"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Input, NumberField, SectionHeader, SurfaceCard, Switch, Text, Textarea } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { AUTOMATION_KEYS, CHANNEL_RULES, type AutomationKey, type Cadence, type ContentSettings, type Pillar } from "@/lib/module-content-shared";
import {
  applyCadencePresetsAction, applyPillarPresetsAction, runAutomationsNowAction, saveBrandAction, saveCadenceAction, savePillarsAction, setAutomationAction,
} from "./actions";
import { CHIPS_CLASS_NAME, FORM_CLASS_NAME, FORM_ROW_CLASS_NAME } from "./classNames";

export type SettingsPanelProps = {
  readonly pillars: ReadonlyArray<Pillar>;
  readonly cadence: ReadonlyArray<Cadence>;
  readonly settings: ContentSettings;
  readonly canManage: boolean;
};

type Say = (tone: "ok" | "error", text: string) => void;

type PillarRow = { id?: string; name: string; description: string; weight: number; active: boolean };

const PillarsCard = ({ pillars, canManage, say }: { readonly pillars: ReadonlyArray<Pillar>; readonly canManage: boolean; readonly say: Say }) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Array<PillarRow>>(pillars.map((p) => ({ id: p.id, name: p.name, description: p.description, weight: p.weight, active: p.active })));
  const patch = (i: number, p: Partial<PillarRow>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const save = () => startTransition(async () => {
    const r = await savePillarsAction(rows);
    if (r.ok) { say("ok", t("saveDone")); router.refresh(); } else say("error", t("actionFailed", { error: r.error }));
  });
  const preset = () => startTransition(async () => {
    const r = await applyPillarPresetsAction();
    if (r.ok) { say("ok", t("saveDone")); router.refresh(); } else say("error", t("actionFailed", { error: r.error }));
  });
  return (
    <SurfaceCard ariaLabel={t("settingsPillars")}>
      <div className={`${FORM_CLASS_NAME} p-4`}>
        <SectionHeader level={2} title={t("settingsPillars")} description={t("settingsPillarsBody")} />
        {rows.map((r, i) => (
          <div key={r.id ?? `new${i}`} className={FORM_ROW_CLASS_NAME}>
            <Input id={`pillar-name-${i}`} name={`pillar-name-${i}`} label={t("pillarName")} variant="secondary" value={r.name} isDisabled={!canManage || isPending} onValueChange={(v) => patch(i, { name: v })} />
            <Input id={`pillar-desc-${i}`} name={`pillar-desc-${i}`} label={t("pillarDesc")} variant="secondary" value={r.description} isDisabled={!canManage || isPending} onValueChange={(v) => patch(i, { description: v })} />
            <NumberField label={t("pillarWeight")} value={r.weight} minValue={0} maxValue={20} isDisabled={!canManage || isPending} onValueChange={(v) => patch(i, { weight: v })} />
            <div className={CHIPS_CLASS_NAME}>
              <Switch label={t("pillarActive")} isSelected={r.active} isDisabled={!canManage || isPending} onSelectedChange={(v) => patch(i, { active: v })} />
              <Button variant="ghost" size="sm" isDisabled={!canManage || isPending} onPress={() => setRows((cur) => cur.filter((_, j) => j !== i))}>{t("remove")}</Button>
            </div>
          </div>
        ))}
        <div className={CHIPS_CLASS_NAME}>
          <Button variant="outline" size="sm" isDisabled={!canManage || isPending} onPress={() => setRows((cur) => [...cur, { name: "", description: "", weight: 1, active: true }])}>{t("pillarAdd")}</Button>
          {rows.length === 0 ? <Button variant="secondary" size="sm" isDisabled={!canManage || isPending} onPress={preset}>{t("pillarPreset")}</Button> : null}
          <Button variant="primary" size="sm" isPending={isPending} isDisabled={!canManage} onPress={save}>{t("pillarSave")}</Button>
        </div>
      </div>
    </SurfaceCard>
  );
};

type CadenceRow = { channel: string; on: boolean; perWeek: number; days: Array<number>; time: string };

const CadenceCard = ({ cadence, canManage, say }: { readonly cadence: ReadonlyArray<Cadence>; readonly canManage: boolean; readonly say: Say }) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Array<CadenceRow>>(() => CHANNEL_RULES.map((c) => {
    const cur = cadence.find((x) => x.channel === c.key);
    return { channel: c.key, on: !!cur && cur.posts_per_week > 0, perWeek: cur?.posts_per_week ?? 3, days: cur ? [...cur.days] : [], time: cur?.post_time ?? "19:30" };
  }));
  const patch = (i: number, p: Partial<CadenceRow>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const days = t("dayShort").split(",");
  const save = () => startTransition(async () => {
    const r = await saveCadenceAction(rows.filter((x) => x.on).map((x) => ({ channel: x.channel, postsPerWeek: x.perWeek, days: x.days, time: x.time })));
    if (r.ok) { say("ok", t("saveDone")); router.refresh(); } else say("error", t("actionFailed", { error: r.error }));
  });
  const preset = () => startTransition(async () => {
    const r = await applyCadencePresetsAction();
    if (r.ok) { say("ok", t("saveDone")); router.refresh(); } else say("error", t("actionFailed", { error: r.error }));
  });
  return (
    <SurfaceCard ariaLabel={t("settingsCadence")}>
      <div className={`${FORM_CLASS_NAME} p-4`}>
        <SectionHeader level={2} title={t("settingsCadence")} description={t("settingsCadenceBody")} />
        {rows.map((r, i) => (
          <div key={r.channel} className="flex flex-col gap-2 rounded-lg border border-separator p-3">
            <Switch label={`${t("cadenceOn")}: ${CHANNEL_RULES[i].label}`} isSelected={r.on} isDisabled={!canManage || isPending} onSelectedChange={(v) => patch(i, { on: v })} />
            {r.on ? (
              <div className={FORM_ROW_CLASS_NAME}>
                <NumberField label={t("cadencePerWeek")} value={r.perWeek} minValue={1} maxValue={21} isDisabled={!canManage || isPending} onValueChange={(v) => patch(i, { perWeek: v })} />
                <Input id={`cad-time-${r.channel}`} name={`cad-time-${r.channel}`} label={t("cadenceTime")} variant="secondary" value={r.time} hint={t("addTimeHint")} isDisabled={!canManage || isPending} onValueChange={(v) => patch(i, { time: v })} />
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Text size="sm" weight="medium">{t("cadenceDays")}</Text>
                  <div className={CHIPS_CLASS_NAME}>
                    {days.map((d, k) => {
                      const dayNo = k + 1;
                      const sel = r.days.includes(dayNo);
                      return (
                        <Button key={d} variant={sel ? "primary" : "outline"} size="sm" isDisabled={!canManage || isPending} onPress={() => patch(i, { days: sel ? r.days.filter((x) => x !== dayNo) : [...r.days, dayNo].sort() })}>{d}</Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        <div className={CHIPS_CLASS_NAME}>
          <Button variant="secondary" size="sm" isDisabled={!canManage || isPending} onPress={preset}>{t("cadencePreset")}</Button>
          <Button variant="primary" size="sm" isPending={isPending} isDisabled={!canManage} onPress={save}>{t("cadenceSave")}</Button>
        </div>
      </div>
    </SurfaceCard>
  );
};

const BrandCard = ({ settings, canManage, say }: { readonly settings: ContentSettings; readonly canManage: boolean; readonly say: Say }) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [voice, setVoice] = useState(settings.brand_voice);
  const [avoid, setAvoid] = useState(settings.avoid);
  const [cta, setCta] = useState(settings.cta);
  const [tags, setTags] = useState(settings.hashtags.join(" "));
  const save = () => startTransition(async () => {
    const r = await saveBrandAction({ brandVoice: voice, avoid, cta, hashtags: tags });
    if (r.ok) { say("ok", t("saveDone")); router.refresh(); } else say("error", t("actionFailed", { error: r.error }));
  });
  return (
    <SurfaceCard ariaLabel={t("settingsBrand")}>
      <div className={`${FORM_CLASS_NAME} p-4`}>
        <SectionHeader level={2} title={t("settingsBrand")} description={t("settingsBrandBody")} />
        <Textarea label={t("brandVoice")} rows={3} value={voice} isDisabled={!canManage || isPending} onValueChange={setVoice} />
        <Textarea label={t("brandAvoid")} rows={3} value={avoid} isDisabled={!canManage || isPending} onValueChange={setAvoid} />
        <Input id="brand-cta" name="brand-cta" label={t("brandCta")} variant="secondary" value={cta} isDisabled={!canManage || isPending} onValueChange={setCta} />
        <Input id="brand-tags" name="brand-tags" label={t("brandHashtags")} variant="secondary" value={tags} hint={t("fieldHashtagsHint")} isDisabled={!canManage || isPending} onValueChange={setTags} />
        <div className={CHIPS_CLASS_NAME}><Button variant="primary" size="sm" isPending={isPending} isDisabled={!canManage} onPress={save}>{t("brandSave")}</Button></div>
      </div>
    </SurfaceCard>
  );
};

const AUTO_COPY: Record<AutomationKey, { title: "autoReminder" | "autoOffer" | "autoSummary"; body: "autoReminderBody" | "autoOfferBody" | "autoSummaryBody" }> = {
  today_reminder: { title: "autoReminder", body: "autoReminderBody" },
  offer_draft: { title: "autoOffer", body: "autoOfferBody" },
  weekly_summary: { title: "autoSummary", body: "autoSummaryBody" },
};

const AutomationCard = ({ settings, canManage, say }: { readonly settings: ContentSettings; readonly canManage: boolean; readonly say: Say }) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [on, setOn] = useState<Record<AutomationKey, boolean>>(settings.automations);
  const toggle = (key: AutomationKey, v: boolean) => {
    setOn((cur) => ({ ...cur, [key]: v }));
    startTransition(async () => {
      const r = await setAutomationAction(key, v);
      if (r.ok) { say("ok", t("saveDone")); router.refresh(); } else { setOn((cur) => ({ ...cur, [key]: !v })); say("error", t("actionFailed", { error: r.error })); }
    });
  };
  const runNow = () => startTransition(async () => {
    const r = await runAutomationsNowAction();
    if (r.ok) say("ok", r.data.did.length ? t("autoRunDone", { what: r.data.did.join("; ") }) : t("autoRunNothing"));
    else say("error", t("actionFailed", { error: r.error }));
    router.refresh();
  });
  return (
    <SurfaceCard ariaLabel={t("settingsAuto")}>
      <div className={`${FORM_CLASS_NAME} p-4`}>
        <SectionHeader level={2} title={t("settingsAuto")} description={t("settingsAutoBody")} />
        {AUTOMATION_KEYS.map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <Switch label={t(AUTO_COPY[k].title)} description={t(AUTO_COPY[k].body)} isSelected={on[k]} isDisabled={!canManage || isPending} onSelectedChange={(v) => toggle(k, v)} />
          </div>
        ))}
        <div className={CHIPS_CLASS_NAME}><Button variant="outline" size="sm" isPending={isPending} isDisabled={!canManage} onPress={runNow}>{t("autoRunNow")}</Button></div>
      </div>
    </SurfaceCard>
  );
};

/** Settings: themes, posting rhythm, brand voice and the three automations. */
export const SettingsPanel = ({ pillars, cadence, settings, canManage }: SettingsPanelProps) => {
  const t = useT(content);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const say: Say = (tone, text) => setNote({ tone, text });
  return (
    <>
      {!canManage ? <Alert title={t("readOnly")} tone="informative" /> : null}
      {note ? <Alert title={note.text} tone={note.tone === "ok" ? "affirmative" : "negative"} dismissLabel={t("close")} onDismiss={() => setNote(null)} /> : null}
      <PillarsCard pillars={pillars} canManage={canManage} say={say} />
      <CadenceCard cadence={cadence} canManage={canManage} say={say} />
      <BrandCard settings={settings} canManage={canManage} say={say} />
      <AutomationCard settings={settings} canManage={canManage} say={say} />
    </>
  );
};
