"use client"

import { useMemo, useState, type RefObject } from "react"
import { Alert, Button, Icon, Text, Textarea } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar"
import { NivoLogo } from "@/components/brand/NivoLogo"
import { useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { Agent } from "@/lib/types"
import {
  CHIPS_CLASS_NAME,
  COMPOSER_CLASS_NAME,
  COMPOSER_FIELD_CLASS_NAME,
  COMPOSER_ROW_CLASS_NAME,
  MEMBER_TEXT_CLASS_NAME,
  MENTION_ACTIVE_CLASS_NAME,
  MENTION_LIST_CLASS_NAME,
  MENTION_OPTION_CLASS_NAME,
  NIVO_OPTION_MARK_CLASS_NAME,
  SR_ONLY_CLASS_NAME,
  WIDE_ONLY_CLASS_NAME,
} from "./classNames"

const MENTION_AT_END = /(^|\s)@([a-z0-9-]*)$/

type MentionOption =
  | { readonly kind: "nivo"; readonly handle: string }
  | { readonly kind: "agent"; readonly handle: string; readonly agent: Agent }
  | { readonly kind: "staff"; readonly handle: string; readonly member: OfficeStaffMember }

/** An active staff member as an Office member: a person with an @handle derived from the name. */
export type OfficeStaffMember = { readonly id: string; readonly name: string; readonly role: string; readonly handle: string }

const lowerVi = (s: string) => s.toLocaleLowerCase("vi").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")

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
}

/** Pinned composer: a slim row of quick questions, then @, the message field and Send. */
export const Composer = ({
  draft, agents, staff = [], chatbotHandle = null, error, isPending, hostRef, onDraftChange, onSend,
}: ComposerProps) => {
  const t = useT(office)
  const quickPrompts = [t("promptNivoAuthority"), t("promptNivoExceptions"), t("promptAttention"), t("promptSummary"), t("promptInvoices")]
  const prompts = chatbotHandle === null ? quickPrompts : [...quickPrompts, t("promptChatbot", { handle: chatbotHandle })]
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  const match = MENTION_AT_END.exec(draft)
  const options = useMemo(() => {
    if (!match || dismissedFor === draft) return []
    const query = match[2] ?? ""
    const list: Array<MentionOption> = agents
      .filter((a) => a.status === "active" && (a.handle.startsWith(query) || a.name.toLowerCase().startsWith(query)))
      .map((a) => ({ kind: "agent" as const, handle: a.handle, agent: a }))
    const people: Array<MentionOption> = staff
      .filter((m) => m.handle.startsWith(query) || lowerVi(m.name).split(/s+/).some((w) => w.startsWith(query)))
      .map((m) => ({ kind: "staff" as const, handle: m.handle, member: m }))
    const all = [...list, ...people]
    return "nivo".startsWith(query) ? [{ kind: "nivo" as const, handle: "nivo" }, ...all] : all
  }, [agents, staff, draft, dismissedFor, match])
  const index = Math.min(activeIndex, Math.max(options.length - 1, 0))

  const focusField = () => hostRef.current?.querySelector("textarea")?.focus()

  const onPickMention = (handle: string) => {
    onDraftChange(draft.replace(MENTION_AT_END, (_all, lead: string) => `${lead}@${handle} `))
    setActiveIndex(0)
    focusField()
  }

  const onAt = () => {
    onDraftChange(`${draft}${draft && !draft.endsWith(" ") ? " " : ""}@`)
    setDismissedFor(null)
    focusField()
  }

  const onPrompt = (prompt: string) => {
    onDraftChange(prompt)
    focusField()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (options.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const step = event.key === "ArrowDown" ? 1 : -1
        setActiveIndex((index + step + options.length) % options.length)
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        const picked = options[index]
        if (picked) onPickMention(picked.handle)
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        setDismissedFor(draft)
        return
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className={COMPOSER_CLASS_NAME}>
      {options.length > 0 ? (
        <div className={MENTION_LIST_CLASS_NAME} role="listbox" aria-label={t("mentionLabel")}>
          {options.map((option, position) => (
            <button
              key={option.handle}
              type="button"
              role="option"
              aria-selected={position === index}
              className={position === index ? `${MENTION_OPTION_CLASS_NAME} ${MENTION_ACTIVE_CLASS_NAME}` : MENTION_OPTION_CLASS_NAME}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPickMention(option.handle)}
            >
              {option.kind === "nivo" ? (
                <span className={NIVO_OPTION_MARK_CLASS_NAME} aria-hidden="true"><NivoLogo variant="mark" height={20} /></span>
              ) : option.kind === "staff" ? (
                <PersonAvatar name={option.member.name} size="sm" />
              ) : (
                <AgentAvatar module={option.agent.module} label={option.agent.name} size="sm" online />
              )}
              <span className={MEMBER_TEXT_CLASS_NAME}>
                <Text weight="medium" overflow="truncate">{option.kind === "nivo" ? t("nivoCore") : option.kind === "staff" ? option.member.name : option.agent.name}</Text>
                <Text size="sm" tone="muted" overflow="truncate">
                  {option.kind === "nivo"
                    ? `@nivo · ${t("nivoRole")}`
                    : option.kind === "staff"
                      ? `@${option.handle} · ${option.member.role || t("staffTag")}`
                      : `@${option.agent.handle} · ${option.agent.role}`}
                </Text>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <Alert tone="negative" title={t("sendFailed")} description={error} /> : null}
      <div className={CHIPS_CLASS_NAME} role="group" aria-label={t("quickLabel")}>
        {prompts.map((prompt) => (
          <Button key={prompt} variant="secondary" size="sm" onPress={() => onPrompt(prompt)}>{prompt}</Button>
        ))}
      </div>
      <div className={COMPOSER_ROW_CLASS_NAME}>
        <Button variant="ghost" onPress={onAt}>
          <span aria-hidden="true">@</span>
          <span className={SR_ONLY_CLASS_NAME}>{t("mentionButton")}</span>
        </Button>
        <div ref={hostRef} className={COMPOSER_FIELD_CLASS_NAME} role="presentation" onKeyDown={onKeyDown}>
          <Textarea
            label={t("composerLabel")}
            isLabelHidden
            placeholder={t("composerPlaceholder")}
            rows={1}
            value={draft}
            onValueChange={(value) => {
              setActiveIndex(0)
              onDraftChange(value)
            }}
          />
        </div>
        <Button
          variant="primary"
          isPending={isPending}
          isDisabled={draft.trim().length === 0}
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
