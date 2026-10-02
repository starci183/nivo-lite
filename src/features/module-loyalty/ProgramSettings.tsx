"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Alert, Button, Heading, Input, Select, SurfaceCard, Switch, Text } from "@starci/grammar/common";
import type { SettingsExtraProps } from "@/features/module-settings/registry";
import { useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { LoyaltyConfig } from "@/lib/module-loyalty-shared";
import { loadProgramAction, saveProgramAction } from "./actions";
import { BODY_CLASS_NAME, FIELD_PAIR_CLASS_NAME, FIELD_TRIPLE_CLASS_NAME, FORM_CLASS_NAME, LINK_ROW_CLASS_NAME, LINK_VALUE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, SUBROW_CLASS_NAME } from "./classNames";

type TierDraft = { key: string; name: string; minSpend: string; multiplier: string; winback: string; benefit: string };
type CategoryDraft = { match: string; rate: string; label: string };
type Form = {
  name: string; enabled: boolean;
  perThousand: string; perVisit: string; minOrder: string; trigger: "payment" | "order"; categories: Array<CategoryDraft>;
  tiers: Array<TierDraft>;
  expiryMonths: string; warnDays: string;
  birthdayOn: boolean; birthdayPoints: string; birthdayReward: string; birthdayNote: string;
  maxPerMonth: string; hourFrom: string; hourTo: string; batch: string;
};
type Loaded = { slug: string; rewards: Array<{ key: string; name: string }> };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const decimal = (v: string): string => v.replace(/[^\d.,]/g, "").slice(0, 8);
const whole = (v: string): string => v.replace(/[^\d]/g, "").slice(0, 12);
const toNum = (s: string, fallback = 0): number => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

const toForm = (name: string, enabled: boolean, c: LoyaltyConfig): Form => ({
  name, enabled,
  perThousand: String(c.earn.perThousandVnd), perVisit: String(c.earn.perVisit), minOrder: String(c.earn.minOrderVnd), trigger: c.earn.trigger,
  categories: c.earn.categories.map((x) => ({ match: x.match, rate: String(x.perThousandVnd), label: x.label })),
  tiers: c.tiers.map((x) => ({ key: x.key, name: x.name, minSpend: String(x.minSpendVnd), multiplier: String(x.multiplier), winback: String(x.winbackDays), benefit: x.benefit })),
  expiryMonths: String(c.expiry.months), warnDays: String(c.expiry.warnDays),
  birthdayOn: c.birthday.enabled, birthdayPoints: String(c.birthday.points), birthdayReward: c.birthday.rewardKey, birthdayNote: c.birthday.note,
  maxPerMonth: String(c.promo.maxPerMonth), hourFrom: c.promo.hourFrom, hourTo: c.promo.hourTo, batch: String(c.promo.batch),
});

const toConfig = (f: Form): LoyaltyConfig => ({
  earn: {
    perThousandVnd: toNum(f.perThousand), perVisit: toNum(f.perVisit), minOrderVnd: toNum(f.minOrder), trigger: f.trigger,
    categories: f.categories.filter((x) => x.match.trim()).map((x) => ({ match: x.match.trim(), perThousandVnd: toNum(x.rate), label: x.label.trim() })),
  },
  tiers: f.tiers.map((x, i) => ({ key: x.key, name: x.name.trim(), minSpendVnd: i === 0 ? 0 : toNum(x.minSpend), multiplier: toNum(x.multiplier, 1), winbackDays: toNum(x.winback, 45), benefit: x.benefit.trim() })),
  expiry: { months: toNum(f.expiryMonths), warnDays: toNum(f.warnDays, 30) },
  birthday: { enabled: f.birthdayOn, points: toNum(f.birthdayPoints), rewardKey: f.birthdayReward, note: f.birthdayNote.trim() },
  promo: { maxPerMonth: toNum(f.maxPerMonth, 2), hourFrom: f.hourFrom, hourTo: f.hourTo, batch: toNum(f.batch, 20) },
});

const Section = ({ title, hint, children }: { readonly title: string; readonly hint?: string; readonly children: ReactNode }) => (
  <SurfaceCard label={title} headingLevel={2}>
    <div className={BODY_CLASS_NAME}>
      {hint ? <Text size="sm" tone="muted">{hint}</Text> : null}
      <div className={FORM_CLASS_NAME}>{children}</div>
    </div>
  </SurfaceCard>
);

/** Settings extra of the loyalty module: the whole programme (earn rules, tiers, expiry, birthday, promotion limits, public page) in one form with one Save. */
export const LoyaltyProgramExtras = ({ canEdit }: SettingsExtraProps) => {
  const t = useT(loyalty);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
    let live = true;
    void loadProgramAction().then((r) => {
      if (!live) return;
      if (r.ok) {
        const f = toForm(r.data.name, r.data.enabled, r.data.config);
        setLoaded({ slug: r.data.slug, rewards: r.data.rewards });
        setForm(f);
      } else setLoadError(r.error);
    });
    return () => {
      live = false;
    };
  }, []);

  if (loadError) {
    return (
      <SurfaceCard ariaLabel={t("programFailed")}>
        <Alert title={t("programFailed")} description={loadError} tone="negative" />
      </SurfaceCard>
    );
  }
  if (!form || !loaded) {
    return (
      <SurfaceCard ariaLabel={t("loading")}>
        <div className={BODY_CLASS_NAME}><Text size="sm" tone="muted" live="polite">{t("loading")}</Text></div>
      </SurfaceCard>
    );
  }

  const off = !canEdit || pending;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setResult(null);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };
  const setTier = (i: number, patch: Partial<TierDraft>) => set("tiers", form.tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setCat = (i: number, patch: Partial<CategoryDraft>) => set("categories", form.categories.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const problems = (): string | null => {
    if (!form.name.trim()) return t("errName");
    if (form.tiers.length === 0) return t("errTiers");
    if (form.tiers.some((x) => !x.name.trim())) return t("errTierName");
    for (let i = 1; i < form.tiers.length; i += 1) if (toNum(form.tiers[i].minSpend) <= (i === 1 ? 0 : toNum(form.tiers[i - 1].minSpend))) return t("errTierOrder");
    if (!HHMM.test(form.hourFrom) || !HHMM.test(form.hourTo)) return t("errHours");
    return null;
  };

  const save = () => {
    const bad = problems();
    if (bad) return setResult({ ok: false, text: bad });
    setResult(null);
    startTransition(async () => {
      const r = await saveProgramAction({ name: form.name.trim(), enabled: form.enabled, config: toConfig(form) });
      setResult(r.ok ? { ok: true, text: t("programSaved") } : { ok: false, text: r.error });
    });
  };

  const url = `${origin}/l/${loaded.slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const rewardOptions = [{ id: "none", label: t("birthdayNoReward") }, ...loaded.rewards.map((r) => ({ id: r.key, label: r.name }))];
  const triggerOptions = [{ id: "payment", label: t("triggerPayment") }, { id: "order", label: t("triggerOrder") }];

  return (
    <>
      {!canEdit ? <Text size="sm" tone="muted">{t("readOnlyNote")}</Text> : null}

      <Section title={t("setEarnTitle")} hint={t("setEarnHint")}>
        <Input id="lp-name" name="name" label={t("setName")} variant="secondary" value={form.name} isDisabled={off} onValueChange={(v) => set("name", v.slice(0, 60))} />
        <div className={FIELD_TRIPLE_CLASS_NAME}>
          <Input id="lp-per-thousand" name="perThousand" label={t("setPerThousand")} variant="secondary" hint={t("setPerThousandHint")} value={form.perThousand} isDisabled={off} onValueChange={(v) => set("perThousand", decimal(v))} />
          <Input id="lp-per-visit" name="perVisit" label={t("setPerVisit")} variant="secondary" value={form.perVisit} isDisabled={off} onValueChange={(v) => set("perVisit", whole(v))} />
          <Input id="lp-min-order" name="minOrder" label={t("setMinOrder")} variant="secondary" hint={t("setMinOrderHint")} value={form.minOrder} isDisabled={off} onValueChange={(v) => set("minOrder", whole(v))} />
        </div>
        <Select label={t("setTrigger")} description={t("setTriggerHint")} options={triggerOptions} value={form.trigger} isDisabled={off} onValueChange={(v) => set("trigger", v === "order" ? "order" : "payment")} />

        <Heading level={3}>{t("setCategories")}</Heading>
        <Text size="sm" tone="muted">{t("setCategoriesHint")}</Text>
        {form.categories.map((c, i) => (
          <div key={i} className={SUBROW_CLASS_NAME}>
            <div className={FIELD_TRIPLE_CLASS_NAME}>
              <Input id={`lp-cat-match-${i}`} name={`catMatch${i}`} label={t("setCatMatch")} variant="secondary" value={c.match} isDisabled={off} onValueChange={(v) => setCat(i, { match: v.slice(0, 40) })} />
              <Input id={`lp-cat-rate-${i}`} name={`catRate${i}`} label={t("setCatRate")} variant="secondary" value={c.rate} isDisabled={off} onValueChange={(v) => setCat(i, { rate: decimal(v) })} />
              <Input id={`lp-cat-label-${i}`} name={`catLabel${i}`} label={t("setCatLabel")} variant="secondary" value={c.label} isDisabled={off} onValueChange={(v) => setCat(i, { label: v.slice(0, 40) })} />
            </div>
            {canEdit ? <div><Button variant="danger-soft" size="sm" isDisabled={pending} onPress={() => set("categories", form.categories.filter((_, j) => j !== i))}>{t("setRemove")}</Button></div> : null}
          </div>
        ))}
        {canEdit && form.categories.length < 12 ? <div><Button variant="outline" size="sm" isDisabled={pending} onPress={() => set("categories", [...form.categories, { match: "", rate: "1", label: "" }])}>{t("setAddCategory")}</Button></div> : null}
      </Section>

      <Section title={t("setTiersTitle")} hint={t("setTiersHint")}>
        {form.tiers.map((x, i) => (
          <div key={x.key || `new-${i}`} className={SUBROW_CLASS_NAME}>
            <div className={FIELD_PAIR_CLASS_NAME}>
              <Input id={`lp-tier-name-${i}`} name={`tierName${i}`} label={t("setTierName")} variant="secondary" value={x.name} isDisabled={off} onValueChange={(v) => setTier(i, { name: v.slice(0, 30) })} />
              <Input id={`lp-tier-spend-${i}`} name={`tierSpend${i}`} label={t("setTierSpend")} variant="secondary" hint={i === 0 ? t("setTierFirst") : undefined} value={i === 0 ? "0" : x.minSpend} isDisabled={off || i === 0} onValueChange={(v) => setTier(i, { minSpend: whole(v) })} />
              <Input id={`lp-tier-mult-${i}`} name={`tierMult${i}`} label={t("setTierMult")} variant="secondary" hint={t("setTierMultHint")} value={x.multiplier} isDisabled={off} onValueChange={(v) => setTier(i, { multiplier: decimal(v) })} />
              <Input id={`lp-tier-winback-${i}`} name={`tierWinback${i}`} label={t("setTierWinback")} variant="secondary" hint={t("setTierWinbackHint")} value={x.winback} isDisabled={off} onValueChange={(v) => setTier(i, { winback: whole(v).slice(0, 3) })} />
            </div>
            <Input id={`lp-tier-benefit-${i}`} name={`tierBenefit${i}`} label={t("setTierBenefit")} variant="secondary" value={x.benefit} isDisabled={off} onValueChange={(v) => setTier(i, { benefit: v.slice(0, 200) })} />
            {canEdit && form.tiers.length > 1 && i > 0 ? <div><Button variant="danger-soft" size="sm" isDisabled={pending} onPress={() => set("tiers", form.tiers.filter((_, j) => j !== i))}>{t("setRemove")}</Button></div> : null}
          </div>
        ))}
        {canEdit && form.tiers.length < 8 ? <div><Button variant="outline" size="sm" isDisabled={pending} onPress={() => set("tiers", [...form.tiers, { key: "", name: "", minSpend: "", multiplier: "1", winback: "45", benefit: "" }])}>{t("setAddTier")}</Button></div> : null}
      </Section>

      <Section title={t("setExpiryTitle")} hint={t("setExpiryHint")}>
        <div className={FIELD_PAIR_CLASS_NAME}>
          <Input id="lp-expiry-months" name="expiryMonths" label={t("setExpiryMonths")} variant="secondary" hint={t("setExpiryMonthsHint")} value={form.expiryMonths} isDisabled={off} onValueChange={(v) => set("expiryMonths", whole(v).slice(0, 3))} />
          <Input id="lp-warn-days" name="warnDays" label={t("setWarnDays")} variant="secondary" hint={t("setWarnDaysHint")} value={form.warnDays} isDisabled={off} onValueChange={(v) => set("warnDays", whole(v).slice(0, 3))} />
        </div>
      </Section>

      <Section title={t("setBirthdayTitle")}>
        <Switch label={t("setBirthdayOn")} isSelected={form.birthdayOn} isDisabled={off} onSelectedChange={(v) => set("birthdayOn", v)} />
        <div className={FIELD_PAIR_CLASS_NAME}>
          <Input id="lp-birthday-points" name="birthdayPoints" label={t("setBirthdayPoints")} variant="secondary" value={form.birthdayPoints} isDisabled={off || !form.birthdayOn} onValueChange={(v) => set("birthdayPoints", whole(v))} />
          <Select label={t("setBirthdayReward")} options={rewardOptions} value={form.birthdayReward || "none"} isDisabled={off || !form.birthdayOn} onValueChange={(v) => set("birthdayReward", !v || v === "none" ? "" : v)} />
        </div>
        <Input id="lp-birthday-note" name="birthdayNote" label={t("setBirthdayNote")} variant="secondary" hint={t("setBirthdayNoteHint")} value={form.birthdayNote} isDisabled={off || !form.birthdayOn} onValueChange={(v) => set("birthdayNote", v.slice(0, 200))} />
      </Section>

      <Section title={t("setPromoTitle")} hint={t("setPromoHint")}>
        <div className={FIELD_PAIR_CLASS_NAME}>
          <Input id="lp-max-month" name="maxPerMonth" label={t("setMaxPerMonth")} variant="secondary" value={form.maxPerMonth} isDisabled={off} onValueChange={(v) => set("maxPerMonth", whole(v).slice(0, 2))} />
          <Input id="lp-batch" name="batch" label={t("setBatch")} variant="secondary" hint={t("setBatchHint")} value={form.batch} isDisabled={off} onValueChange={(v) => set("batch", whole(v).slice(0, 3))} />
          <Input id="lp-hour-from" name="hourFrom" label={t("setHourFrom")} variant="secondary" placeholder="08:00" value={form.hourFrom} isError={!HHMM.test(form.hourFrom)} errorMessage={!HHMM.test(form.hourFrom) ? t("errHours") : undefined} isDisabled={off} onValueChange={(v) => set("hourFrom", v.replace(/[^\d:]/g, "").slice(0, 5))} />
          <Input id="lp-hour-to" name="hourTo" label={t("setHourTo")} variant="secondary" placeholder="21:00" value={form.hourTo} isError={!HHMM.test(form.hourTo)} errorMessage={!HHMM.test(form.hourTo) ? t("errHours") : undefined} isDisabled={off} onValueChange={(v) => set("hourTo", v.replace(/[^\d:]/g, "").slice(0, 5))} />
        </div>
      </Section>

      <Section title={t("setPublicTitle")} hint={t("publicBody")}>
        <Switch label={t("setPublicOn")} isSelected={form.enabled} isDisabled={off} onSelectedChange={(v) => set("enabled", v)} />
        <div className={LINK_ROW_CLASS_NAME}>
          <code className={LINK_VALUE_CLASS_NAME}>{url}</code>
          <Button variant="outline" onPress={copy}>{copied ? t("copied") : t("copy")}</Button>
        </div>
      </Section>

      {canEdit ? (
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="primary" isPending={pending} onPress={save}>{t("setSave")}</Button>
        </div>
      ) : null}
      <div aria-live="polite">
        {result ? <Alert title={result.ok ? t("saved") : t("notSaved")} description={result.ok ? undefined : result.text} tone={result.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </>
  );
};
