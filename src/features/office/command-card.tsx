"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Alert, Badge, Button, ChatBubble, DescriptionList, SurfaceCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import { cancelOfficeCommand, confirmOfficeCommand } from "@/lib/office-command-actions"
import type { CommandCandidate } from "@/lib/office-command-rules"
import { acceptsOf, commandOf, moduleName, type ModuleKey } from "@/lib/module-registry"
import type { Agent } from "@/lib/types"
import { APPROVAL_ACTIONS_CLASS_NAME, APPROVAL_BODY_CLASS_NAME, APPROVAL_CARD_CLASS_NAME, AVATAR_SLOT_CLASS_NAME, ROW_FIRST_CLASS_NAME } from "./classNames"
import { NivoAvatar } from "./messages"

/** DOM id of the thread card for one command candidate. */
export const commandAnchor = (candidateId: string): string => `command-${candidateId}`

/** True when this agent accepts commands, so a manager's message to it is read as one. */
export const acceptsCommands = (agent: Agent | undefined): boolean => !!agent && agent.status === "active" && acceptsOf(agent.module as ModuleKey).length > 0

/** Where a work item lives: the receiving department's workbench, focused on it. */
export const workItemHref = (module: string, workItemId: string): string => `/m/${module}/workbench?focus=${workItemId}`

/** Props for {@link CommandCard}. */
export type CommandCardProps = {
  /** The candidate; null while the card is only a skeleton (NIVO is still reading the message). */
  readonly candidate: CommandCandidate | null
  /** Handle of the mentioned agent (the skeleton has no candidate yet). */
  readonly handle: string
  readonly module: ModuleKey
  /** STATE-8: real labels, only the unresolved text and figures as skeleton, no live control. */
  readonly isLoading?: boolean
}

/**
 * The confirm card under an owner's "@agent ..." message: which agent, what command, the fields NIVO filled, then two separate Buttons
 * (way out first, the primary last). Sending hands the command to the bus as the owner; the receiving agent's own gate still decides, and
 * the card then links to the work item. Settled cards stay in the thread as a record.
 */
export const CommandCard = ({ candidate, handle, module, isLoading = false }: CommandCardProps) => {
  const t = useT(office)
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"send" | "cancel" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<boolean | null>(null)

  const agent = moduleName(module, locale)
  const accepted = candidate ? commandOf(module, candidate.command) : null
  const what = accepted ? (locale === "en" ? accepted.description.en : accepted.description.vi) : (candidate?.command ?? "")
  const isPendingCard = candidate?.status === "pending"
  const detail = error ?? candidate?.refusal_detail ?? null

  const onSend = () => {
    if (!candidate) return
    setError(null)
    setBusy("send")
    startTransition(async () => {
      const result = await confirmOfficeCommand(candidate.id).catch(() => ({ ok: false as const, error: t("cmdFailed") }))
      if (result.ok) {
        setCreated(result.data.created)
        router.refresh()
      } else {
        setError(result.error)
      }
      setBusy(null)
    })
  }

  const onCancel = () => {
    if (!candidate) return
    setError(null)
    setBusy("cancel")
    startTransition(async () => {
      const result = await cancelOfficeCommand(candidate.id).catch(() => ({ ok: false as const, error: t("cmdFailed") }))
      if (result.ok) router.refresh()
      else setError(result.error)
      setBusy(null)
    })
  }

  const items = [
    { id: "agent", term: t("cmdRowAgent"), description: <Text weight="medium">{agent}</Text> },
    { id: "command", term: t("cmdRowCommand"), description: <Text weight="medium">{what}</Text> },
    ...(candidate?.shown ?? []).map((row) => ({ id: row.key, term: row.label, description: <Text weight="medium">{row.value}</Text> })),
  ]

  const status =
    candidate?.status === "sent" ? (
      <Badge tone="success" isDot>{t("cmdSentBadge")}</Badge>
    ) : candidate?.status === "cancelled" ? (
      <Badge tone="neutral" isDot>{t("cmdCancelledBadge")}</Badge>
    ) : (
      <Badge tone="warning" isDot isSkeleton={isLoading}>{t("cmdPending")}</Badge>
    )

  return (
    <div className={ROW_FIRST_CLASS_NAME} data-testid="office-command-card" data-status={isLoading ? "loading" : candidate?.status}>
      <ChatBubble
        id={candidate ? commandAnchor(candidate.id) : undefined}
        author={t("nivoCore")}
        avatar={<div className={AVATAR_SLOT_CLASS_NAME}><NivoAvatar /></div>}
        footer={
          // BOUNDARY-5: the card sits under the message, inside the messenger card, so it is a nested SurfaceCard.
          <div className={APPROVAL_CARD_CLASS_NAME}>
            <SurfaceCard depth="nested" ariaLabel={t("cmdCardLabel", { agent })}>
              <div className={APPROVAL_BODY_CLASS_NAME}>
                <div>{status}</div>
                <DescriptionList layout="columns" isDivided isLoading={isLoading} items={items} />
                {isLoading ? (
                  <Text size="xs" tone="muted" isSkeleton>{t("cmdGateNote", { agent })}</Text>
                ) : candidate?.status === "sent" ? (
                  <Text size="xs" tone="muted" live="polite">{created === false ? t("cmdAlready") : t("cmdSentNote", { agent })}</Text>
                ) : candidate?.status === "cancelled" ? (
                  <Text size="xs" tone="muted">{t("cmdCancelledNote")}</Text>
                ) : (
                  <Text size="xs" tone="muted">{t("cmdGateNote", { agent })}</Text>
                )}
                {detail && isPendingCard ? <Alert tone="negative" title={t("cmdFailed")} description={detail} /> : null}
                {isLoading || isPendingCard ? (
                  <div className={APPROVAL_ACTIONS_CLASS_NAME}>
                    <Button variant="ghost" size="sm" isSkeleton={isLoading} isDisabled={isLoading || isPending} onPress={onCancel}>{t("cmdCancel")}</Button>
                    <Button variant="primary" size="sm" isSkeleton={isLoading} isPending={isPending && busy === "send"} isDisabled={isLoading || isPending} onPress={onSend}>{t("cmdSend")}</Button>
                  </div>
                ) : candidate?.status === "sent" && candidate.work_item_id ? (
                  <div className={APPROVAL_ACTIONS_CLASS_NAME}>
                    <Button variant="secondary" size="sm" href={workItemHref(candidate.module, candidate.work_item_id)}>{t("cmdOpenWork")}</Button>
                  </div>
                ) : null}
              </div>
            </SurfaceCard>
          </div>
        }
      >
        <Text as="p" isSkeleton={isLoading}>{isLoading ? t("cmdAskReading", { handle }) : t("cmdAsk", { handle })}</Text>
      </ChatBubble>
    </div>
  )
}
