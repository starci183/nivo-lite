"use client"

import { useState } from "react"
import { Badge, Button, Text } from "@starci/grammar/common"
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar"
import { NivoLogo } from "@/components/brand/NivoLogo"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { Agent, Message } from "@/lib/types"
import {
  AI_CHIP_CLASS_NAME,
  AUTHOR_LINE_CLASS_NAME,
  AVATAR_SLOT_CLASS_NAME,
  BUBBLE_ACTIONS_CLASS_NAME,
  BUBBLE_ACTIONS_MINE_CLASS_NAME,
  BUBBLE_WRAP_CLASS_NAME,
  BUBBLE_COLUMN_CLASS_NAME,
  BUBBLE_COLUMN_MINE_CLASS_NAME,
  BUBBLE_MINE_CLASS_NAME,
  BUBBLE_NIVO_CLASS_NAME,
  BUBBLE_THEIRS_CLASS_NAME,
  DAY_CLASS_NAME,
  DAY_RULE_CLASS_NAME,
  MENTION_CLASS_NAME,
  NIVO_AVATAR_CLASS_NAME,
  NOTICE_CLASS_NAME,
  ROW_FIRST_CLASS_NAME,
  ROW_MINE_CLASS_NAME,
  ROW_THEIRS_CLASS_NAME,
} from "./classNames"
import { formatTime } from "./format"

/** Props for {@link DaySeparator}. */
export type DaySeparatorProps = { readonly label: string }

/** Day divider such as "Today" or "Yesterday". */
export const DaySeparator = ({ label }: DaySeparatorProps) => (
  <div className={DAY_CLASS_NAME} role="separator" aria-label={label}>
    <span className={DAY_RULE_CLASS_NAME} />
    <Text size="xs" tone="muted" weight="medium">{label}</Text>
    <span className={DAY_RULE_CLASS_NAME} />
  </div>
)

/** Highlight @handles inside a message body. */
export const renderBody = (body: string) =>
  body.split(/(@[a-z0-9-]+)/g).map((part, index) =>
    /^@[a-z0-9-]+$/.test(part) ? <span key={`${index}-${part}`} className={MENTION_CLASS_NAME}>{part}</span> : part,
  )

/** Small coral "AI" chip for AI-written content. */
export const AiChip = () => {
  const t = useT(office)
  return (
    <span className={AI_CHIP_CLASS_NAME}>
      <Badge tone="neutral">{t("aiBadge")}</Badge>
    </span>
  )
}

/** True for messages written by NIVO Core itself (engine events, authority and decision replies). */
export const isNivoMessage = (message: Message): boolean => message.author_kind !== "human" && message.agent_id === null && /^nivo\b/i.test(message.author_name.trim())

/** NIVO mark on a white tile: the avatar of NIVO Core. */
export const NivoAvatar = ({ size = "sm" }: { readonly size?: "xs" | "sm" }) => (
  <span className={NIVO_AVATAR_CLASS_NAME} style={size === "xs" ? { width: 24, height: 24 } : undefined} role="img" aria-label="NIVO">
    <NivoLogo variant="mark" height={size === "xs" ? 14 : 20} />
  </span>
)

/** Props for {@link MessageRow}. */
export type MessageRowProps = {
  readonly message: Message
  /** The agent that wrote the message, when an agent did. */
  readonly agent: Agent | null
  /** True when the signed-in person wrote it (right-aligned bubble). */
  readonly isMine: boolean
  /** Contact name of the lead the message points at, when known. */
  readonly leadName: string | null
  readonly isContinuation: boolean
  readonly onReply: (handle: string) => void
}

/** One chat bubble (person, agent or me) or a centred system notice. */
export const MessageRow = ({ message, agent, isMine, leadName, isContinuation, onReply }: MessageRowProps) => {
  const t = useT(office)
  const locale = useLocale()
  const [isCopied, setIsCopied] = useState(false)

  const onCopy = () => {
    void navigator.clipboard
      .writeText(message.body)
      .then(() => {
        setIsCopied(true)
        window.setTimeout(() => setIsCopied(false), 1500)
      })
      .catch(() => setIsCopied(false))
  }

  const isNivo = isNivoMessage(message)

  if (message.author_kind === "system" && !isNivo) {
    return (
      <div className={NOTICE_CLASS_NAME}>
        <Text size="sm" tone="muted">{message.body}</Text>
        {message.lead_id ? (
          <Button variant="ghost" size="sm" href={`/leads/${message.lead_id}`}>{t("noticeLead", { name: leadName ?? t("leadFallback") })}</Button>
        ) : null}
      </div>
    )
  }

  const isAgent = message.author_kind === "agent"
  const time = formatTime(message.created_at, locale)
  const rowClass = isMine ? ROW_MINE_CLASS_NAME : ROW_THEIRS_CLASS_NAME
  return (
    <div className={isContinuation ? rowClass : `${rowClass} ${ROW_FIRST_CLASS_NAME}`}>
      {isMine ? null : (
        <div className={AVATAR_SLOT_CLASS_NAME}>
          {isContinuation ? null : isNivo ? (
            <NivoAvatar />
          ) : isAgent ? (
            <AgentAvatar module={agent?.module} label={message.author_name} size="sm" />
          ) : (
            <PersonAvatar name={message.author_name} size="sm" />
          )}
        </div>
      )}
      <div className={isMine ? `${BUBBLE_COLUMN_CLASS_NAME} ${BUBBLE_COLUMN_MINE_CLASS_NAME}` : BUBBLE_COLUMN_CLASS_NAME}>
        {isContinuation ? null : (
          <div className={AUTHOR_LINE_CLASS_NAME}>
            {isMine ? null : <Text size="sm" weight="semibold">{isNivo ? t("nivoCore") : message.author_name}</Text>}
            {isAgent && !isNivo ? <AiChip /> : null}
            <Text size="xs" tone="muted">{time}</Text>
          </div>
        )}
        <div className={BUBBLE_WRAP_CLASS_NAME}>
          <div className={isMine ? BUBBLE_MINE_CLASS_NAME : isNivo ? BUBBLE_NIVO_CLASS_NAME : BUBBLE_THEIRS_CLASS_NAME} title={isContinuation ? time : undefined}>
            <Text as="p">{renderBody(message.body)}</Text>
          </div>
          <div className={isMine ? `${BUBBLE_ACTIONS_CLASS_NAME} ${BUBBLE_ACTIONS_MINE_CLASS_NAME}` : BUBBLE_ACTIONS_CLASS_NAME}>
            <Button variant="ghost" size="sm" onPress={onCopy}>{isCopied ? t("copied") : t("copyText")}</Button>
            {message.lead_id ? <Button variant="ghost" size="sm" href={`/leads/${message.lead_id}`}>{t("openLead")}</Button> : null}
            {isAgent && agent ? <Button variant="ghost" size="sm" onPress={() => onReply(agent.handle)}>{t("reply")}</Button> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Props for {@link PendingBubble}. */
export type PendingBubbleProps = { readonly body: string; readonly failed: boolean }

/** Optimistic owner bubble shown at once while the send is in flight (or marked failed). */
export const PendingBubble = ({ body, failed }: PendingBubbleProps) => {
  const t = useT(office)
  return (
    <div className={`${ROW_MINE_CLASS_NAME} ${ROW_FIRST_CLASS_NAME}`} data-testid="msg-pending" data-status={failed ? "failed" : "sending"}>
      <div className={`${BUBBLE_COLUMN_CLASS_NAME} ${BUBBLE_COLUMN_MINE_CLASS_NAME}`}>
        <div className={BUBBLE_WRAP_CLASS_NAME}>
          <div className={BUBBLE_MINE_CLASS_NAME} style={failed ? undefined : { opacity: 0.7 }}>
            <Text as="p">{renderBody(body)}</Text>
          </div>
        </div>
        <Text size="xs" tone="muted" live="polite">{failed ? t("sendFailed") : t("sending")}</Text>
      </div>
    </div>
  )
}
