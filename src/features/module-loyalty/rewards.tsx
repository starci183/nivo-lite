"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, EmptyNotice, Input, Select, SurfaceCard, Switch, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import { formatVndShort, tierOf, type LoyaltyConfig, type Reward, type RewardKind } from "@/lib/module-loyalty-shared";
import { addPresetRewardsAction, deleteRewardAction, saveRewardAction } from "./actions";
import { BODY_CLASS_NAME, CHIPS_CLASS_NAME, FIELD_PAIR_CLASS_NAME, FORM_CLASS_NAME, LIST_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { formatNumber, parseDigits } from "./format";

const KINDS: ReadonlyArray<RewardKind> = ["voucher", "item", "percent"];
type Note = { readonly ok: boolean; readonly text: string };

const digitsOnly = (v: string): string => v.replace(/[^\d]/g, "").slice(0, 10);

/** The add / edit form of one reward. */
const RewardForm = ({ reward, config, onDone }: { readonly reward: Reward | null; readonly config: LoyaltyConfig; readonly onDone: () => void }) => {
  const t = useT(loyalty);
  const router = useRouter();
  const [name, setName] = useState(reward?.name ?? "");
  const [kind, setKind] = useState<RewardKind>(reward?.kind ?? "voucher");
  const [cost, setCost] = useState(reward ? String(reward.pointsCost) : "");
  const [value, setValue] = useState(reward ? String(reward.valueVnd) : "");
  const [percent, setPercent] = useState(reward?.percent ? String(reward.percent) : "");
  const [stock, setStock] = useState(reward?.stock != null ? String(reward.stock) : "");
  const [limit, setLimit] = useState(reward?.perCustomerLimit != null ? String(reward.perCustomerLimit) : "");
  const [minTier, setMinTier] = useState(reward?.minTierKey ?? "any");
  const [note, setNote] = useState(reward?.note ?? "");
  const [active, setActive] = useState(reward?.active ?? true);
  const [result, setResult] = useState<Note | null>(null);
  const [pending, startTransition] = useTransition();

  const costN = parseDigits(cost);
  const costBad = cost !== "" && (costN === null || costN < 1);

  const save = () => {
    setResult(null);
    if (!name.trim()) return setResult({ ok: false, text: t("rewardNameRequired") });
    if (costN === null || costN < 1) return setResult({ ok: false, text: t("rewardCostRequired") });
    startTransition(async () => {
      const r = await saveRewardAction({
        id: reward?.id, key: reward?.key, name: name.trim(), kind, valueVnd: parseDigits(value) ?? 0, percent: kind === "percent" ? parseDigits(percent) ?? 10 : null,
        pointsCost: costN, stock: parseDigits(stock), perCustomerLimit: parseDigits(limit), minTierKey: minTier === "any" ? null : minTier, note: note.trim(), active,
      });
      if (r.ok) {
        router.refresh();
        onDone();
      } else setResult({ ok: false, text: r.error });
    });
  };

  const kindOptions = KINDS.map((k) => ({ id: k, label: t(`rewardKind_${k}`) }));
  const tierOptions = [{ id: "any", label: t("anyTier") }, ...config.tiers.map((x) => ({ id: x.key, label: x.name }))];

  return (
    <div className={FORM_CLASS_NAME}>
      <Input id="reward-name" name="name" label={t("rewardName")} variant="secondary" isRequired value={name} isDisabled={pending} onValueChange={(v) => setName(v.slice(0, 80))} />
      <div className={FIELD_PAIR_CLASS_NAME}>
        <Select label={t("rewardKind")} options={kindOptions} value={kind} isDisabled={pending} onValueChange={(v) => setKind(KINDS.find((k) => k === v) ?? "voucher")} />
        <Input id="reward-cost" name="cost" label={t("rewardCost")} variant="secondary" isRequired value={cost} isError={costBad} errorMessage={costBad ? t("rewardCostRequired") : undefined} isDisabled={pending} onValueChange={(v) => setCost(digitsOnly(v))} />
      </div>
      <div className={FIELD_PAIR_CLASS_NAME}>
        <Input id="reward-value" name="value" label={t("rewardValue")} variant="secondary" hint={t("rewardValueHint")} value={value} isDisabled={pending} onValueChange={(v) => setValue(digitsOnly(v))} />
        {kind === "percent" ? <Input id="reward-percent" name="percent" label={t("rewardPercent")} variant="secondary" value={percent} isDisabled={pending} onValueChange={(v) => setPercent(digitsOnly(v).slice(0, 3))} /> : null}
      </div>
      <div className={FIELD_PAIR_CLASS_NAME}>
        <Input id="reward-stock" name="stock" label={t("rewardStock")} variant="secondary" hint={t("rewardStockHint")} value={stock} isDisabled={pending} onValueChange={(v) => setStock(digitsOnly(v))} />
        <Input id="reward-limit" name="limit" label={t("rewardLimit")} variant="secondary" hint={t("rewardLimitHint")} value={limit} isDisabled={pending} onValueChange={(v) => setLimit(digitsOnly(v))} />
      </div>
      <Select label={t("rewardMinTier")} options={tierOptions} value={minTier} isDisabled={pending} onValueChange={(v) => setMinTier(v ?? "any")} />
      <Textarea label={t("rewardNote")} rows={2} maxLength={200} value={note} isDisabled={pending} onValueChange={setNote} />
      <Switch label={t("rewardActive")} isSelected={active} isDisabled={pending} onSelectedChange={setActive} />
      <div className={ROW_ACTIONS_CLASS_NAME}>
        <Button variant="primary" isPending={pending} onPress={save}>{t("save")}</Button>
        <Button variant="outline" isDisabled={pending} onPress={onDone}>{t("cancel")}</Button>
      </div>
      <div aria-live="polite">{result ? <Text size="sm" weight="medium">{result.text}</Text> : null}</div>
    </div>
  );
};

/** One reward row: facts, the active switch and the edit / delete actions (managers). */
const RewardRow = ({ reward, config, canManage, onEdit }: { readonly reward: Reward; readonly config: LoyaltyConfig; readonly canManage: boolean; readonly onEdit: () => void }) => {
  const t = useT(loyalty);
  const locale = useLocale();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tier = reward.minTierKey ? tierOf(config, reward.minTierKey) : null;

  const toggle = (active: boolean) => {
    setError(null);
    startTransition(async () => {
      const r = await saveRewardAction({
        id: reward.id, key: reward.key, name: reward.name, kind: reward.kind, valueVnd: reward.valueVnd, percent: reward.percent, pointsCost: reward.pointsCost,
        stock: reward.stock, perCustomerLimit: reward.perCustomerLimit, minTierKey: reward.minTierKey, note: reward.note, active,
      });
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  };
  const remove = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteRewardAction(reward.id);
      if (r.ok) router.refresh();
      else setError(r.error);
      setConfirming(false);
    });
  };

  return (
    <li className={ROW_CLASS_NAME}>
      <div className={ROW_MAIN_CLASS_NAME}>
        <div className={CHIPS_CLASS_NAME}>
          <Text as="span" weight="semibold">{reward.name}</Text>
          <Badge tone="neutral">{reward.kind === "percent" && reward.percent ? `${t("rewardKind_percent")} ${reward.percent}%` : t(`rewardKind_${reward.kind}`)}</Badge>
          <Badge tone={reward.active ? "success" : "warning"}>{reward.active ? t("rewardOn") : t("rewardOff")}</Badge>
        </div>
        <Text size="sm">{t("points", { n: formatNumber(reward.pointsCost, locale) })}{reward.valueVnd > 0 ? ` · ${t("rewardValueShort", { value: formatVndShort(reward.valueVnd) })}` : ""}</Text>
        <Text size="sm" tone="muted">
          {[
            reward.stock === null ? t("stockUnlimited") : t("stockLeft", { n: reward.stock }),
            reward.perCustomerLimit === null ? t("limitNone") : t("limitPer", { n: reward.perCustomerLimit }),
            tier ? t("fromTier", { name: tier.name }) : t("anyTier"),
          ].join(" · ")}
        </Text>
        {reward.note ? <Text size="xs" tone="muted">{reward.note}</Text> : null}
        {error ? <Text size="sm" live="assertive">{error}</Text> : null}
      </div>
      {canManage ? (
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Switch label={t("rewardActive")} isSelected={reward.active} isDisabled={pending} onSelectedChange={toggle} />
          <Button variant="outline" size="sm" isDisabled={pending} onPress={onEdit}>{t("edit")}</Button>
          {confirming ? (
            <>
              <Text as="span" size="sm" weight="medium" live="polite">{t("deleteAsk")}</Text>
              <Button variant="danger" size="sm" isPending={pending} onPress={remove}>{t("deleteConfirm")}</Button>
              <Button variant="ghost" size="sm" isDisabled={pending} onPress={() => setConfirming(false)}>{t("cancel")}</Button>
            </>
          ) : (
            <Button variant="danger-soft" size="sm" isDisabled={pending} onPress={() => setConfirming(true)}>{t("delete")}</Button>
          )}
        </div>
      ) : null}
    </li>
  );
};

/** Surface 3: the reward catalogue. Managers edit; everyone else reads. */
export const RewardsPanel = ({ data }: { readonly data: LoyaltyWorkbenchData }) => {
  const t = useT(loyalty);
  const router = useRouter();
  const cfg = data.program.config;
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [pending, startTransition] = useTransition();
  const target = editing === "new" ? null : data.rewards.find((r) => r.id === editing) ?? null;

  const preset = () => {
    setNote(null);
    startTransition(async () => {
      const r = await addPresetRewardsAction();
      setNote(r.ok ? { ok: true, text: t("presetDone", { n: r.data.added }) } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <>
      <SurfaceCard label={t("rewardsTitle")} headingLevel={2} labelEnd={data.canManage && !editing ? <Button variant="primary" size="sm" onPress={() => setEditing("new")}>{t("rewardAdd")}</Button> : undefined}>
        {data.rewards.length === 0 ? (
          <>
            <EmptyNotice message={t("rewardsEmptyTitle")} description={data.canManage ? t("rewardsEmptyBody") : t("rewardsEmptyBodyStaff")} />
            {data.canManage ? (
              <div className={BODY_CLASS_NAME}>
                <div>
                  <Button variant="primary" isPending={pending} onPress={preset}>{t("presetButton")}</Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <ul className={LIST_CLASS_NAME}>
            {data.rewards.map((r) => <RewardRow key={r.id} reward={r} config={cfg} canManage={data.canManage} onEdit={() => setEditing(r.id)} />)}
          </ul>
        )}
        <div className={BODY_CLASS_NAME} aria-live="polite">{note ? <Text size="sm" weight="medium">{note.text}</Text> : null}</div>
        {!data.canManage ? <div className={BODY_CLASS_NAME}><Text size="xs" tone="muted">{t("readOnlyNote")}</Text></div> : null}
      </SurfaceCard>

      {data.canManage && editing ? (
        <SurfaceCard label={target ? t("rewardEditTitle") : t("rewardAdd")} headingLevel={2}>
          <div className={BODY_CLASS_NAME}>
            <RewardForm key={editing} reward={target} config={cfg} onDone={() => setEditing(null)} />
          </div>
        </SurfaceCard>
      ) : null}
    </>
  );
};
