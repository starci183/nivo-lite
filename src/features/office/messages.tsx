"use client"

import { useState } from "react"
import { Avatar, Badge, Button, ButtonGroup, ChatBubble, Divider, Text } from "@starci/grammar/common"
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar"
import { NivoLogo } from "@/components/brand/NivoLogo"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { Agent, Message } from "@/lib/types"
import { AVATAR_SLOT_CLASS_NAME, DAY_CLASS_NAME, NOTICE_CLASS_NAME, ROW_FIRST_CLASS_NAME } from "./classNames"
import { formatTime } from "./format"

/** Props for {@link DaySeparator}. */
export type DaySeparatorProps = { readonly label: string }

/** Day divider such as "Today" or "Yesterday": the labelled Grammar Divider (BOUNDARY-5 case-4 anatomy: rule, word, rule). */
export const DaySeparator = ({ label }: DaySeparatorProps) => (
  <div className={DAY_CLASS_NAME}>
    <Divider label={label} />
  </div>
)

/** Highlight @handles inside a message body. */
export const renderBody = (body: string) =>
  body.split(/(@[a-z0-9-]+)/g).map((part, index) =>
    /^@[a-z0-9-]+$/.test(part) ? <Text key={`${index}-${part}`} as="span" weight="medium" tone="accent">{part}</Text> : part,
  )

/** "AI" marker for AI-written content: a neutral Badge (a category, not a status, takes no status tone). */
export const AiChip = () => {
  const t = useT(office)
  return <Badge tone="neutral">{t("aiBadge")}</Badge>
}

/** True for messages written by NIVO Core itself (engine events, authority and decision replies). */
export const isNivoMessage = (message: Message): boolean => message.author_kind !== "human" && message.agent_id === null && /^nivo\b/i.test(message.author_name.trim())

/** The avatar of NIVO Core: Grammar `Avatar` with the NIVO mark as its fallback (the Avatar owns the round frame). */
export const NivoAvatar = ({ isDecorative = false }: { readonly isDecorative?: boolean }) => (
  <Avatar name="NIVO" size="sm" isDecorative={isDecorative} fallback={<NivoLogo variant="mark" height={16} />} />
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

/** One chat message (person, agent or me) as a Grammar ChatBubble, or a centred system notice. */
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
  const author = isNivo ? t("nivoCore") : message.author_name
  // ChatBubble owns the message anatomy (avatar column, author line, face, hover actions); the thread owns grouping.
  const bubble = (
    <ChatBubble
      side={isMine ? "outgoing" : "incoming"}
      author={isContinuation || isMine ? undefined : author}
      avatar={
        isMine ? undefined : (
          // The slot keeps the avatar width on grouped follow-ups so their faces line up.
          <div className={AVATAR_SLOT_CLASS_NAME}>
            {isContinuation ? null : isNivo ? (
              <NivoAvatar />
            ) : isAgent ? (
              <AgentAvatar module={agent?.module} label={message.author_name} size="sm" />
            ) : (
              <PersonAvatar name={message.author_name} size="sm" />
            )}
          </div>
        )
      }
      status={!isContinuation && isAgent && !isNivo ? <AiChip /> : undefined}
      meta={isContinuation ? undefined : time}
      actions={
        <ButtonGroup label={`${author} · ${time}`}>
          <Button variant="secondary" size="sm" onPress={onCopy}>{isCopied ? t("copied") : t("copyText")}</Button>
          {message.lead_id ? <Button variant="secondary" size="sm" href={`/leads/${message.lead_id}`}>{t("openLead")}</Button> : null}
          {isAgent && agent ? <Button variant="secondary" size="sm" onPress={() => onReply(agent.handle)}>{t("reply")}</Button> : null}
        </ButtonGroup>
      }
    >
      <Text as="p">{renderBody(message.body)}</Text>
    </ChatBubble>
  )
  return isContinuation ? bubble : <div className={ROW_FIRST_CLASS_NAME}>{bubble}</div>
}

/** Props for {@link PendingBubble}. */
export type PendingBubbleProps = { readonly body: string; readonly failed: boolean }

/** Optimistic owner bubble shown at once while the send is in flight (or marked failed). */
export const PendingBubble = ({ body, failed }: PendingBubbleProps) => {
  const t = useT(office)
  return (
    <div className={ROW_FIRST_CLASS_NAME} data-testid="msg-pending" data-status={failed ? "failed" : "sending"}>
      <ChatBubble side="outgoing" footer={<Text size="xs" tone="muted" live="polite">{failed ? t("sendFailed") : t("sending")}</Text>}>
        <Text as="p">{renderBody(body)}</Text>
      </ChatBubble>
    </div>
  )
}
