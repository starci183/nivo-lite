"use client";

import { useState } from "react";
import { Alert, Badge, Button, DescriptionList, Input, NumberField, RadioGroup, SegmentedControl, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale } from "@/i18n/core";
import { moduleSetup } from "@/i18n/dict/moduleSetup";
import { sameValue, type Scope } from "@/lib/brain/shared";
import type { RuleMode } from "@/lib/flow-types";
import { actionDef, pick } from "@/lib/module-registry";
import type { FactWrite, Resolution, RuleWrite, WriteDecision } from "@/lib/module-setup-writes";
import * as c from "./classNames";

type CardProps = {
  readonly write: FactWrite | RuleWrite;
  /** Sends the owner's decision; resolves to an error message, or undefined when it worked. */
  readonly onDecide: (id: string, change: WriteDecision) => Promise<string | undefined>;
};

const MODES: ReadonlyArray<RuleMode> = ["auto", "ask", "never"];

/** One proposed write of the setup chat. Fact: subject · attribute · value · scope. Rule: action · mode · limit. The owner confirms (edited or not) before anything is written. */
export const SetupWriteCard = ({ write, onDecide }: CardProps) => {
  const t = useT(moduleSetup);
  const locale = useLocale();
  const [isEditing, setEditing] = useState(false);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [resolution, setResolution] = useState<Resolution>("replace");
  const [situation, setSituation] = useState("");
  const [value, setValue] = useState(write.kind === "fact" ? write.payload.value : "");
  const [scope, setScope] = useState<Scope>(write.kind === "fact" ? write.payload.scope : "internal");
  const [mode, setMode] = useState<RuleMode>(write.kind === "rule" ? write.payload.mode : "ask");
  const [limit, setLimit] = useState<number | null>(write.kind === "rule" ? write.payload.limitVnd : null);

  const money = (n: number | null) => (n === null ? t("wLimitNone") : new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n));
  const scopeLabel = (s: Scope) => t(s === "public" ? "wScopePublic" : s === "internal" ? "wScopeInternal" : "wScopeRestricted");
  const modeLabel = (m: RuleMode) => t(`mode_${m}`);
  const head = write.kind === "fact" ? t("wFactTitle") : t("wRuleTitle");

  const decide = async (change: WriteDecision) => {
    setPending(true);
    setError(undefined);
    const message = await onDecide(write.id, change);
    if (message !== undefined) setError(message);
    setPending(false);
  };

  if (write.status !== "proposed") {
    const line = write.kind === "fact"
      ? `${write.payload.subjectLabel} · ${write.payload.attributeLabel}: ${write.payload.value}`
      : `${pick(actionDef(write.payload.action).label, locale)} · ${modeLabel(write.payload.mode)}${actionDef(write.payload.action).amountLimit ? ` · ${money(write.payload.limitVnd)}` : ""}`;
    const label = write.status === "rejected" ? (write.result?.resolution === "keep" ? t("wKept") : t("wRejected")) : write.kind === "fact" ? t("wApplied") : t("wAppliedRule");
    return (
      <div className={c.WRITE_CLASS_NAME}>
        <div className={c.WRITE_HEAD_CLASS_NAME}>
          <Text size="sm" tone="muted">{line}</Text>
          <Badge isDot tone={write.status === "applied" ? "success" : "neutral"}>{label}</Badge>
        </div>
      </div>
    );
  }

  const currentValue = write.kind === "fact" ? write.current?.value : undefined;
  const isConflict = write.kind === "fact" && write.current !== null && !sameValue(write.current.value, value);
  const canConfirm = write.kind === "fact" ? value.trim().length > 0 && (resolution !== "both" || !isConflict || situation.trim().length > 0) : true;

  const confirm = () => {
    if (write.kind === "fact") void decide({ decision: "confirm", fact: { value, scope }, resolution: isConflict ? resolution : undefined, situation: resolution === "both" ? situation : undefined });
    else void decide({ decision: "confirm", rule: { mode, limitVnd: actionDef(write.payload.action).amountLimit ? limit : null } });
  };

  const items = write.kind === "fact"
    ? [
      { id: "subject", term: t("wSubject"), description: write.payload.subjectLabel },
      { id: "attribute", term: t("wAttribute"), description: write.payload.attributeLabel },
      ...(isEditing ? [] : [{ id: "value", term: t("wValue"), description: value }]),
      ...(isEditing ? [] : [{ id: "scope", term: t("wScope"), description: scopeLabel(scope) }]),
    ]
    : [
      { id: "action", term: t("wAction"), description: pick(actionDef(write.payload.action).label, locale) },
      ...(isEditing ? [] : [{ id: "mode", term: t("wMode"), description: modeLabel(mode) }]),
      ...(isEditing || !actionDef(write.payload.action).amountLimit ? [] : [{ id: "limit", term: t("wLimit"), description: money(limit) }]),
      { id: "now", term: t("wNow"), description: write.current ? `${modeLabel(write.current.mode)}${actionDef(write.payload.action).amountLimit ? ` · ${money(write.current.limitVnd)}` : ""}` : t("wNowNone") },
    ];

  return (
    <div className={c.WRITE_CLASS_NAME}>
      <div className={c.WRITE_HEAD_CLASS_NAME}>
        <Text weight="semibold" size="sm">{head}</Text>
        {write.kind === "fact" && write.payload.gapId ? <Badge tone="warning">{t("wGap")}</Badge> : null}
      </div>
      <DescriptionList layout="stacked" items={items} />

      {isEditing ? (
        <div className={c.WRITE_FIELDS_CLASS_NAME}>
          {write.kind === "fact" ? (
            <>
              <Textarea variant="secondary" name={`write-${write.id}-value`} label={t("wValue")} rows={2} maxLength={2000} value={value} onValueChange={setValue} />
              <SegmentedControl
                label={t("wScope")} value={scope} onValueChange={(v) => setScope(v === "public" || v === "restricted" ? v : "internal")}
                options={[{ value: "public", label: t("wScopePublic") }, { value: "internal", label: t("wScopeInternal") }, { value: "restricted", label: t("wScopeRestricted") }]}
              />
            </>
          ) : (
            <>
              <SegmentedControl
                label={t("wMode")} value={mode} onValueChange={(v) => setMode(MODES.find((m) => m === v) ?? "ask")}
                options={MODES.filter((m) => m !== "auto" || actionDef(write.payload.action).maxMode === null).map((m) => ({ value: m, label: modeLabel(m) }))}
              />
              {actionDef(write.payload.action).amountLimit ? (
                <NumberField
                  variant="secondary" label={t("wLimit")} minValue={0} step={1_000_000} formatOptions={{ maximumFractionDigits: 0 }}
                  isDisabled={mode === "never"} value={limit ?? undefined} onValueChange={(v) => setLimit(Number.isFinite(v) ? v : null)}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {isConflict && write.kind === "fact" ? (
        <div className={c.WRITE_FIELDS_CLASS_NAME}>
          <Alert tone="cautionary" title={t("wConflictTitle")} description={t("wConflictBody", { current: currentValue ?? "" })} />
          <RadioGroup
            label={t("wConflictTitle")} isLabelHidden variant="secondary" value={resolution} onValueChange={(v) => setResolution(v === "keep" || v === "both" ? v : "replace")}
            options={[{ value: "replace", label: t("wReplace") }, { value: "keep", label: t("wKeep") }, { value: "both", label: t("wBoth") }]}
          />
          {resolution === "both" ? (
            <Input id={`write-${write.id}-situation`} name="situation" variant="secondary" label={t("wSituation")} value={situation} onValueChange={setSituation} />
          ) : null}
        </div>
      ) : null}

      {error !== undefined ? <Alert tone="negative" title={t("wError")} description={error} /> : null}
      <div className={c.GATE_ACTIONS_CLASS_NAME}>
        <Button variant="primary" size="sm" isPending={isPending} isDisabled={!canConfirm} onPress={confirm}>{t("wConfirm")}</Button>
        <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => setEditing((v) => !v)}>{isEditing ? t("wEditDone") : t("wEdit")}</Button>
        <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => void decide({ decision: "reject" })}>{t("wReject")}</Button>
      </div>
    </div>
  );
};
