"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Badge, Button, ChatBubble, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { AgentAvatar } from "@/components/blocks/AgentAvatar"
import { canDecideItem, useMember } from "@/hooks/member"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import { decideExecution } from "@/lib/actions"
import type { ModuleKey } from "@/lib/types"
import {
  APPROVAL_ACTIONS_CLASS_NAME,
  APPROVAL_BODY_CLASS_NAME,
  APPROVAL_CARD_CLASS_NAME,
  APPROVAL_LINK_CLASS_NAME,
  APPROVAL_QUOTE_CLASS_NAME,
  APPROVAL_STATUS_CLASS_NAME,
  APPROVAL_TEXT_CLASS_NAME,
  AVATAR_SLOT_CLASS_NAME,
  INFO_SECTION_CLASS_NAME,
  INFO_TITLE_CLASS_NAME,
  MEMBER_TEXT_CLASS_NAME,
  PENDING_ROW_CLASS_NAME,
  ROW_FIRST_CLASS_NAME,
} from "./classNames"
import { formatStamp, formatTime } from "./format"
import { AiChip } from "./messages"
import type { PendingApproval } from "./queries"

const DRAFT_PREVIEW_CHARS = 280

/** DOM id of the thread card for one execution, used by the header chip and the info panel. */
export const approvalAnchor = (executionId: string): string => `approval-${executionId}`

/** Props for {@link ApprovalBubble}. */
export type ApprovalBubbleProps = {
  readonly approval: PendingApproval
  /** Module of the drafting agent, for its avatar. */
  readonly module: ModuleKey | undefined
  /** True for a moment after the header chip jumped here. */
  readonly isFocused: boolean
}

/**
 * An approval request as a message from the drafting agent: what will be sent, to whom, and
 * inline "Approve and send / Edit / Reject". Decided requests show who decided and when.
 */
export const ApprovalBubble = ({ approval, module, isFocused }: ApprovalBubbleProps) => {
  const t = useT(office)
  const locale = useLocale()
  const router = useRouter()
  const { execution } = approval
  const [isPending, startTransition] = useTransition()
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(execution.draft)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const me = useMember()
  const canAct = canDecideItem(me, approval.assignedStaffId)
  const isWaiting = execution.status === "pending_approval"
  const isBusy = isPending && decision !== null
  const isLong = execution.draft.length > DRAFT_PREVIEW_CHARS
  const shown = !isWaiting && isLong && !isExpanded ? `${execution.draft.slice(0, DRAFT_PREVIEW_CHARS).trimEnd()}…` : execution.draft

  const onDecide = (next: "approved" | "rejected") => {
    setError(null)
    setDecision(next)
    startTransition(async () => {
      const trimmed = editText.trim()
      const edited = next === "approved" && isEditing && trimmed !== execution.draft ? trimmed : undefined
      const result = await decideExecution(execution.id, next, edited)
      if (result.ok) {
        setIsEditing(false)
        router.refresh()
      } else {
        setError(t("decisionFailed", { error: result.error }))
      }
      setDecision(null)
    })
  }

  const onToggleEdit = () => {
    setEditText(execution.draft)
    setIsEditing((value) => !value)
  }

  const statusWord = execution.status === "approved" ? t("approvalApproved") : t("approvalRejected")
  const who = execution.decided_by ?? t("teammate")
  const settled = execution.decided_at
    ? t("approvalDecided", { status: statusWord, who, time: formatStamp(execution.decided_at, locale) })
    : t("approvalDecidedNoTime", { status: statusWord, who })

  return (
    <div className={ROW_FIRST_CLASS_NAME}>
      <ChatBubble
        id={approvalAnchor(execution.id)}
        author={approval.agentName}
        avatar={
          <div className={AVATAR_SLOT_CLASS_NAME}>
            <AgentAvatar module={module} label={approval.agentName} size="sm" />
          </div>
        }
        meta={formatTime(execution.created_at, locale)}
        footer={
        // BOUNDARY-5: the decision card sits under the message, inside the messenger card, so it is a nested SurfaceCard;
        // the jump focus is its one highlight.
        <div className={APPROVAL_CARD_CLASS_NAME}>
        <SurfaceCard depth="nested" ariaLabel={approval.nextAction || t("approvalWaiting")} isHighlight={isFocused}>
        <div className={APPROVAL_BODY_CLASS_NAME}>
          <div className={APPROVAL_STATUS_CLASS_NAME}>
            {isWaiting ? (
              <Badge tone="warning" isDot>{t("approvalWaiting")}</Badge>
            ) : (
              <Badge tone={execution.status === "approved" ? "success" : "danger"} isDot>{statusWord}</Badge>
            )}
            <AiChip />
            <div className={APPROVAL_LINK_CLASS_NAME}>
              <Button variant="ghost" size="sm" href={approval.href}>{t("openLead")}</Button>
            </div>
          </div>
          {isWaiting && isEditing ? (
            <Textarea label={t("draftLabel")} rows={6} value={editText} isDisabled={isBusy} onValueChange={setEditText} />
          ) : (
            <div className={APPROVAL_QUOTE_CLASS_NAME}>
              <Text as="p" size="sm">{shown}</Text>
            </div>
          )}
          {!isWaiting && isLong ? (
            <div>
              <Button variant="ghost" size="sm" onPress={() => setIsExpanded((value) => !value)}>{isExpanded ? t("showLess") : t("showMore")}</Button>
            </div>
          ) : null}
          <Text size="xs" tone="muted">{isWaiting ? t("approvalPolicy") : settled}</Text>
          {error ? <Text size="sm" live="assertive">{error}</Text> : null}
          {isWaiting && !canAct ? <Text size="sm" weight="medium" live="polite">{t("waitingManager")}</Text> : null}
          {isWaiting && canAct ? (
            <div className={APPROVAL_ACTIONS_CLASS_NAME}>
              <Button
                variant="primary"
                size="sm"
                isPending={isPending && decision === "approved"}
                isDisabled={isBusy || (isEditing && editText.trim().length === 0)}
                onPress={() => onDecide("approved")}
              >
                {isEditing ? t("approveEdited") : t("approveSend")}
              </Button>
              <Button variant="outline" size="sm" isDisabled={isBusy} onPress={onToggleEdit}>{isEditing ? t("cancelEdit") : t("edit")}</Button>
              <Button variant="ghost" size="sm" isPending={isPending && decision === "rejected"} isDisabled={isBusy} onPress={() => onDecide("rejected")}>
                {t("reject")}
              </Button>
            </div>
          ) : null}
        </div>
        </SurfaceCard>
        </div>
        }
      >
        <div className={APPROVAL_TEXT_CLASS_NAME}>
          {approval.nextAction ? <Text weight="semibold">{approval.nextAction}</Text> : null}
          <Text size="sm" tone="muted">
            {approval.channel ? t("approvalTo", { lead: approval.leadName, channel: approval.channel }) : t("approvalToNoChannel", { lead: approval.leadName })}
          </Text>
        </div>
      </ChatBubble>
    </div>
  )
}

/** Props for {@link PendingList}. */
export type PendingListProps = {
  readonly items: ReadonlyArray<PendingApproval>
  readonly moduleOf: (agentId: string | null) => ModuleKey | undefined
  readonly onJump: (executionId: string) => void
}

/** Info-panel list of approval requests; each row jumps to its card in the thread. */
export const PendingList = ({ items, moduleOf, onJump }: PendingListProps) => {
  const t = useT(office)
  return (
    <section className={INFO_SECTION_CLASS_NAME} aria-label={t("pendingTitle")}>
      <div className={INFO_TITLE_CLASS_NAME}>
        <Text weight="semibold">{t("pendingTitle")}</Text>
        <Text size="sm" tone="muted">{`${items.length}`}</Text>
      </div>
      {items.length === 0 ? (
        <Text size="sm" tone="muted">{t("pendingNone")}</Text>
      ) : (
        items.map((item) => (
          // BOUNDARY-5 + STATE-5: one waiting request is a nested card whose whole face jumps to it in the thread.
          <SurfaceCard
            key={item.execution.id}
            depth="nested"
            wholeAction={{ kind: "button", press: () => onJump(item.execution.id), label: `${t("pendingJump")}: ${item.nextAction || item.leadName}` }}
          >
            <div className={PENDING_ROW_CLASS_NAME}>
              <AgentAvatar module={moduleOf(item.execution.agent_id)} label={item.agentName} size="xs" />
              <div className={MEMBER_TEXT_CLASS_NAME}>
                <Text size="sm" weight="medium" overflow="clamp-2">{item.nextAction || item.leadName}</Text>
                <Text size="xs" tone="muted" overflow="truncate">{`${item.agentName} · ${item.leadName}`}</Text>
              </div>
            </div>
          </SurfaceCard>
        ))
      )}
    </section>
  )
}
