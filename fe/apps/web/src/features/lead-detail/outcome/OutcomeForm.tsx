"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Select, Text, Textarea } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { common } from "@/i18n/dict/common";
import { lead as leadDict } from "@/i18n/dict/lead";
import { recordOutcome } from "@/lib/actions";
import type { LeadStage } from "@/lib/types";
import { FORM_STACK } from "./classNames";
import { stageLabel } from "./format";

type OutcomeFormProps = { leadId: string; currentStage: LeadStage };

const STAGE_IDS: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal", "won", "lost"];

/** Form to record a stage change with the evidence behind it. */
export const OutcomeForm = (props: OutcomeFormProps) => {
  const { leadId, currentStage } = props;
  const router = useRouter();
  const t = useT(leadDict);
  const tc = useT(common);
  const stageOptions = STAGE_IDS.map((id) => ({ id, label: stageLabel(id, tc) }));
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<LeadStage>(currentStage);
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await recordOutcome(leadId, stage, evidence.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEvidence("");
      router.refresh();
    });
  };

  return (
    <div className={FORM_STACK}>
      <Select
        label={t("fieldStage")}
        options={stageOptions}
        value={stage}
        onValueChange={(value) => {
          if (value) setStage(value as LeadStage);
        }}
      />
      {stage === "won" ? (
        <Text as="p" size="sm" tone="muted">{t("wonHandoff")}</Text>
      ) : null}
      <Textarea
        label={t("evidence")}
        description={t("evidenceHint")}
        rows={4}
        value={evidence}
        onValueChange={setEvidence}
      />
      {error ? <Alert title={t("outcomeFailed")} description={error} tone="negative" /> : null}
      <Button variant="primary" isPending={isPending} isDisabled={evidence.trim().length === 0} onPress={onSubmit}>
        {t("recordOutcome")}
      </Button>
    </div>
  );
};
