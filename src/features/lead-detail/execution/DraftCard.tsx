"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, SurfaceCard, Text } from "@starci/grammar/common";

import { useT } from "@/i18n/client";
import { lead as leadDict } from "@/i18n/dict/lead";
import { draftExecution } from "@/lib/actions";

import { EXECUTION_CARD_BODY_CLASS_NAME } from "./classNames";

/** Props for the draft card. */
export type DraftCardProps = {
  readonly responsibilityId: string | null;
  readonly explanation: string;
  readonly actorName: string;
  readonly buttonLabel: string;
};

/** Execution card with the single Draft action; runs the agent draft and refreshes the page. */
export const DraftCard = (props: DraftCardProps) => {
  const router = useRouter();
  const t = useT(leadDict);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDraft = () => {
    const id = props.responsibilityId;
    if (id === null) return;
    setError(null);
    startTransition(async () => {
      const result = await draftExecution(id);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <SurfaceCard label={t("followUp")}>
      <div className={EXECUTION_CARD_BODY_CLASS_NAME}>
        <Text tone="muted">{props.explanation}</Text>
        {error === null ? null : <Alert tone="negative" title={t("draftFailed")} description={error} />}
        {isPending ? (
          <Text size="sm" tone="muted" live="polite">
            {t("isDrafting", { name: props.actorName })}
          </Text>
        ) : null}
        <Button variant="primary" isPending={isPending} isDisabled={props.responsibilityId === null} onPress={onDraft}>
          {props.buttonLabel}
        </Button>
      </div>
    </SurfaceCard>
  );
};
