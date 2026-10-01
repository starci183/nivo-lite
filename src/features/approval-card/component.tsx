"use client";

import { useState } from "react";
import { Badge, Button, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";

import { useLocale, useT } from "@/i18n/client";
import { approval } from "@/i18n/dict/approval";

import type { Execution } from "@/lib/types";

import {
  APPROVAL_CARD_ACTIONS_CLASS_NAME,
  APPROVAL_CARD_BAND_CLASS_NAME,
  APPROVAL_CARD_BAND_DIVIDED_CLASS_NAME,
  APPROVAL_CARD_COLUMN_CLASS_NAME,
  APPROVAL_CARD_META_ROW_CLASS_NAME,
  APPROVAL_CARD_QUOTE_CLASS_NAME,
  APPROVAL_CARD_STATUS_ROW_CLASS_NAME,
} from "./classNames";
import { AiChip } from "./AiChip";
import { formatClock } from "./format";

/** Props for the presentational approval card. */
export type ApprovalCardBaseProps = {
  readonly execution: Execution;
  readonly leadName: string;
  readonly channel: string;
  readonly agentName: string | null;
  readonly nextAction: string;
  readonly href?: string;
  /** False when the signed-in member may not decide this draft (staff, not assigned): the buttons give way to a note. */
  readonly canDecide?: boolean;
  readonly isEditing: boolean;
  readonly editText: string;
  readonly pendingDecision: "approved" | "rejected" | null;
  readonly error: string | null;
  readonly onToggleEdit: () => void;
  readonly onEditChange: (value: string) => void;
  readonly onDecide: (decision: "approved" | "rejected") => void;
};

/** Ghost button that copies the message text and confirms it in place. */
const CopyDraftButton = ({ text }: { readonly text: string }) => {
  const t = useT(approval);
  const [isCopied, setIsCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => setIsCopied(false));
  };
  return (
    <Button variant="ghost" size="sm" onPress={onCopy}>
      {isCopied ? t("copied") : t("copy")}
    </Button>
  );
};

/** Pure approval card: pending shows the decision bands, settled shows who decided and the final text. */
export const ApprovalCardBase = (props: ApprovalCardBaseProps) => {
  const { execution, leadName, channel, agentName, nextAction, href, isEditing, editText, pendingDecision, error } = props;
  const t = useT(approval);
  const locale = useLocale();
  const isWaiting = execution.status === "pending_approval";
  const isBusy = pendingDecision !== null;
  const statusWord = execution.status === "approved" ? t("approved") : t("rejected");
  const settledLabel = `${t("decidedBy", { status: statusWord, who: execution.decided_by ?? t("teammate") })}${
    execution.decided_at === null ? "" : ` · ${formatClock(execution.decided_at, locale)}`
  }`;
  const draftLength = (isEditing && isWaiting ? editText : execution.draft).length;
  return (
    <div className={APPROVAL_CARD_COLUMN_CLASS_NAME}>
      <SurfaceCard composition="joined" depth="nested" ariaLabel={nextAction}>
        <div className={APPROVAL_CARD_BAND_CLASS_NAME}>
          <div className={APPROVAL_CARD_STATUS_ROW_CLASS_NAME}>
            {agentName === null ? null : <AgentAvatar module="chatbot" size="sm" label={agentName} />}
            {isWaiting ? (
              <Badge tone="warning">{t("needsApproval")}</Badge>
            ) : (
              <Badge tone={execution.status === "approved" ? "success" : "danger"}>{statusWord}</Badge>
            )}
            {agentName === null ? null : <AiChip />}
          </div>
          <Text weight="semibold">{nextAction}</Text>
          <Text size="sm" tone="muted">{t("willSend", { lead: leadName, channel })}</Text>
        </div>
        <div className={APPROVAL_CARD_BAND_DIVIDED_CLASS_NAME}>
          {isWaiting && isEditing ? (
            <Textarea label={t("draftLabel")} rows={8} value={editText} isDisabled={isBusy} onValueChange={props.onEditChange} />
          ) : (
            <div className={APPROVAL_CARD_QUOTE_CLASS_NAME}>
              <Text>{execution.draft}</Text>
            </div>
          )}
          <div className={APPROVAL_CARD_META_ROW_CLASS_NAME}>
            <Text size="xs" tone="muted">{t("characters", { count: draftLength })}</Text>
            <CopyDraftButton text={isWaiting && isEditing ? editText : execution.draft} />
          </div>
          {error === null ? null : <Text size="sm" live="assertive">{error}</Text>}
          {isWaiting && props.canDecide === false ? <Text size="sm" weight="medium" live="polite">{t("waitingManager")}</Text> : null}
          {isWaiting && props.canDecide !== false ? (
            <div className={APPROVAL_CARD_ACTIONS_CLASS_NAME}>
              <Button
                variant="primary"
                isPending={pendingDecision === "approved"}
                isDisabled={isBusy || (isEditing && editText.trim().length === 0)}
                onPress={() => props.onDecide("approved")}
              >
                {t("approveSend")}
              </Button>
              <Button variant="outline" isDisabled={isBusy} onPress={props.onToggleEdit}>
                {isEditing ? t("discardEdits") : t("edit")}
              </Button>
              <Button variant="ghost" isPending={pendingDecision === "rejected"} isDisabled={isBusy} onPress={() => props.onDecide("rejected")}>
                {t("reject")}
              </Button>
            </div>
          ) : (
            <div className={APPROVAL_CARD_META_ROW_CLASS_NAME}>
              <Text size="sm" tone="muted">{settledLabel}</Text>
              {href === undefined ? null : <Button variant="ghost" size="sm" href={href}>{t("openLead")}</Button>}
            </div>
          )}
          {isWaiting && href !== undefined ? <Button variant="ghost" size="sm" href={href}>{t("openLead")}</Button> : null}
        </div>
      </SurfaceCard>
    </div>
  );
};
