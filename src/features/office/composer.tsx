"use client"

import { useMemo, type RefObject } from "react"
import { Alert, Button, Icon, Text, Textarea, type TextareaMentionOption } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import { useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { Agent } from "@/lib/types"
import {
  CHIPS_CLASS_NAME,
  COMPOSER_CLASS_NAME,
  COMPOSER_FIELD_CLASS_NAME,
  COMPOSER_ROW_CLASS_NAME,
  SR_ONLY_CLASS_NAME,
  WIDE_ONLY_CLASS_NAME,
} from "./classNames"

/** An active staff member as an Office member: a person with an @handle derived from the name. */
export type OfficeStaffMember = { readonly id: string; readonly name: string; readonly role: string; readonly handle: string }

/** Props for {@link Composer}. */
export type ComposerProps = {
  readonly draft: string
  readonly agents: ReadonlyArray<Agent>
  /** Active staff members (people in the group): @mention targets. Every message is written by the signed-in member. */
  readonly staff?: ReadonlyArray<OfficeStaffMember>
  /** Handle of the bought Chatbot, if any: adds a quick prompt for it. */
  readonly chatbotHandle?: string | null
  readonly error: string | null
  readonly isPending: boolean
  readonly hostRef: RefObject<HTMLDivElement | null>
  readonly onDraftChange: (value: string) => void
  readonly onSend: () => void
  /** STATE-8: the composer stays in place, disabled, until the conversation has loaded. */
  readonly isLoading?: boolean
}

/** Pinned composer: a slim row of quick questions, then @, the message field and Send. */
export const Composer = ({
  draft, agents, staff = [], chatbotHandle = null, error, isPending, hostRef, onDraftChange, onSend, isLoading = false,
}: ComposerProps) => {
  const t = useT(office)
  const quickPrompts = [t("promptNivoAuthority"), t("promptNivoExceptions"), t("promptAttention"), t("promptSummary"), t("promptInvoices")]
  const prompts = chatbotHandle === null ? quickPrompts : [...quickPrompts, t("promptChatbot", { handle: chatbotHandle })]

  // Mention targets for the Grammar Textarea suggestion list: `label` is the handle inserted after "@".
  const mentionOptions = useMemo<ReadonlyArray<TextareaMentionOption>>(
    () => [
      { id: "nivo", label: "nivo", description: `${t("nivoCore")} · ${t("nivoRole")}` },
      ...agents
        .filter((a) => a.status === "active")
        .map((a) => ({ id: `agent-${a.id}`, label: a.handle, description: `${a.name} · ${a.role}` })),
      ...staff.map((m) => ({ id: `staff-${m.id}`, label: m.handle, description: `${m.name} · ${m.role || t("staffTag")}` })),
    ],
    [agents, staff, t],
  )

  const focusField = () => hostRef.current?.querySelector("textarea")?.focus()

  const onAt = () => {
    onDraftChange(`${draft}${draft && !draft.endsWith(" ") ? " " : ""}@`)
    focusField()
  }

  const onPrompt = (prompt: string) => {
    onDraftChange(prompt)
    focusField()
  }

  return (
    <div className={COMPOSER_CLASS_NAME}>
      {error ? <Alert tone="negative" title={t("sendFailed")} description={error} /> : null}
      <div className={CHIPS_CLASS_NAME} role="group" aria-label={t("quickLabel")}>
        {prompts.map((prompt) => (
          <Button key={prompt} variant="secondary" size="sm" isDisabled={isLoading} onPress={() => onPrompt(prompt)}>{prompt}</Button>
        ))}
      </div>
      <div className={COMPOSER_ROW_CLASS_NAME}>
        <Button variant="ghost" isDisabled={isLoading} onPress={onAt}>
          <span aria-hidden="true">@</span>
          <span className={SR_ONLY_CLASS_NAME}>{t("mentionButton")}</span>
        </Button>
        <div ref={hostRef} className={COMPOSER_FIELD_CLASS_NAME}>
          {/* The Textarea owns the @mention list and Enter-to-send (Shift+Enter breaks the line). */}
          <Textarea
            label={t("composerLabel")}
            isLabelHidden
            variant="secondary"
            placeholder={t("composerPlaceholder")}
            rows={1}
            isSkeleton={isLoading}
            value={draft}
            onValueChange={onDraftChange}
            onSubmitShortcut={onSend}
            mentions={{ options: mentionOptions, label: t("mentionLabel") }}
          />
        </div>
        <Button
          variant="primary"
          isPending={isPending}
          isDisabled={isLoading || draft.trim().length === 0}
          onPress={onSend}
          startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}
        >
          {t("send")}
        </Button>
      </div>
      <div className={WIDE_ONLY_CLASS_NAME}>
        <Text size="xs" tone="muted">{t("composerHint")}</Text>
      </div>
    </div>
  )
}
