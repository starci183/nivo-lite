"use client"

import Link from "next/link"
import { useState } from "react"
import { Button, Icon, SearchField, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { Agent, Message } from "@/lib/types"
import {
  COLUMN_HEAD_CLASS_NAME,
  COUNT_DOT_CLASS_NAME,
  GROUP_AVATAR_CLASS_NAME,
  HEAD_TEXT_CLASS_NAME,
  LIST_BODY_CLASS_NAME,
  LIST_CAPTION_CLASS_NAME,
  LIST_ROW_ACTIVE_CLASS_NAME,
  LIST_ROW_BOTTOM_CLASS_NAME,
  LIST_ROW_CLASS_NAME,
  LIST_ROW_TEXT_CLASS_NAME,
  LIST_ROW_TOP_CLASS_NAME,
  LIST_SEARCH_CLASS_NAME,
  LIST_SECTION_CLASS_NAME,
  NO_SHRINK_CLASS_NAME,
} from "./classNames"
import { listTime } from "./format"

/** A recent customer shown in the list (people you talk to). */
export type CustomerEntry = {
  readonly id: string
  readonly name: string
  readonly preview: string | null
  readonly at: string
}

/** Props for {@link ConversationList}. */
export type ConversationListProps = {
  readonly groupName: string
  readonly messages: ReadonlyArray<Message>
  readonly agents: ReadonlyArray<Agent>
  readonly customers: ReadonlyArray<CustomerEntry>
  readonly pendingCount: number
  readonly nowIso: string
  readonly onOpenGroup: () => void
}

const contains = (text: string, query: string) => text.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))

/** Left column: the Office group chat, each agent (1:1 chat) and recent customers, with search. */
export const ConversationList = ({ groupName, messages, agents, customers, pendingCount, nowIso, onOpenGroup }: ConversationListProps) => {
  const t = useT(office)
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const words = { today: t("today"), yesterday: t("yesterday") }
  const q = query.trim()

  const last = messages.length ? messages[messages.length - 1] : null
  const groupPreview = last ? `${last.author_kind === "system" ? "" : `${last.author_name}: `}${last.body}` : t("groupPreviewEmpty")
  const lastByAgent = (agentId: string) => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i]?.agent_id === agentId) return messages[i] ?? null
    return null
  }

  const showGroup = !q || contains(groupName, q) || contains(t("title"), q)
  const shownAgents = agents.filter((a) => !q || contains(a.name, q) || contains(a.handle, q))
  const shownCustomers = customers.filter((c) => !q || contains(c.name, q))
  const isEmpty = !showGroup && shownAgents.length === 0 && shownCustomers.length === 0

  return (
    <>
      <div className={COLUMN_HEAD_CLASS_NAME}>
        <div className={HEAD_TEXT_CLASS_NAME}>
          <Text weight="semibold">{t("listTitle")}</Text>
        </div>
      </div>
      <div className={LIST_SEARCH_CLASS_NAME}>
        <SearchField label={t("searchLabel")} isLabelHidden placeholder={t("searchPlaceholder")} clearLabel={t("clearSearch")} value={query} onValueChange={setQuery} onClear={() => setQuery("")} />
      </div>
      <nav className={LIST_BODY_CLASS_NAME} aria-label={t("listLabel")}>
        {isEmpty ? <Text size="sm" tone="muted">{t("noMatches", { q })}</Text> : null}
        {showGroup ? (
          <section className={LIST_SECTION_CLASS_NAME} aria-label={t("sectionGroups")}>
            <div className={LIST_CAPTION_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("sectionGroups")}</Text>
            </div>
            <button type="button" className={`${LIST_ROW_CLASS_NAME} ${LIST_ROW_ACTIVE_CLASS_NAME}`} aria-current="true" onClick={onOpenGroup}>
              <span className={GROUP_AVATAR_CLASS_NAME} aria-hidden="true">
                <Icon source={nivoIconSource("community", "leading")} usage="leading" />
              </span>
              <span className={LIST_ROW_TEXT_CLASS_NAME}>
                <span className={LIST_ROW_TOP_CLASS_NAME}>
                  <Text weight="semibold" overflow="truncate">{t("title")}</Text>
                  {last ? <span className={NO_SHRINK_CLASS_NAME}><Text size="xs" tone="muted">{listTime(last.created_at, nowIso, locale, words)}</Text></span> : null}
                </span>
                <span className={LIST_ROW_BOTTOM_CLASS_NAME}>
                  <Text size="sm" tone="muted" overflow="truncate">{groupPreview}</Text>
                  {pendingCount > 0 ? (
                    <span className={COUNT_DOT_CLASS_NAME} role="img" aria-label={t("pendingCount", { n: pendingCount })}>{pendingCount}</span>
                  ) : null}
                </span>
              </span>
            </button>
          </section>
        ) : null}
        {shownAgents.length ? (
          <section className={LIST_SECTION_CLASS_NAME} aria-label={t("sectionAgents")}>
            <div className={LIST_CAPTION_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("sectionAgents")}</Text>
            </div>
            {shownAgents.map((agent) => {
              const said = lastByAgent(agent.id)
              const isActive = agent.status === "active"
              return (
                <Link key={agent.id} href={`/modules/${agent.id}/chat`} className={LIST_ROW_CLASS_NAME}>
                  <AgentAvatar module={agent.module} label={agent.name} online={isActive} />
                  <span className={LIST_ROW_TEXT_CLASS_NAME}>
                    <span className={LIST_ROW_TOP_CLASS_NAME}>
                      <Text weight="semibold" overflow="truncate">{agent.name}</Text>
                      {said ? <span className={NO_SHRINK_CLASS_NAME}><Text size="xs" tone="muted">{listTime(said.created_at, nowIso, locale, words)}</Text></span> : null}
                    </span>
                    <Text size="sm" tone="muted" overflow="truncate">{isActive ? (said?.body ?? agent.role) : t("agentPreviewPaused")}</Text>
                  </span>
                </Link>
              )
            })}
          </section>
        ) : null}
        {shownCustomers.length ? (
          <section className={LIST_SECTION_CLASS_NAME} aria-label={t("sectionCustomers")}>
            <div className={LIST_CAPTION_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("sectionCustomers")}</Text>
              <Button variant="ghost" size="sm" href="/leads">{t("allCustomers")}</Button>
            </div>
            {shownCustomers.map((customer) => (
              <Link key={customer.id} href={`/leads/${customer.id}`} className={LIST_ROW_CLASS_NAME}>
                <PersonAvatar name={customer.name} />
                <span className={LIST_ROW_TEXT_CLASS_NAME}>
                  <span className={LIST_ROW_TOP_CLASS_NAME}>
                    <Text weight="semibold" overflow="truncate">{customer.name}</Text>
                    <span className={NO_SHRINK_CLASS_NAME}><Text size="xs" tone="muted">{listTime(customer.at, nowIso, locale, words)}</Text></span>
                  </span>
                  <Text size="sm" tone="muted" overflow="truncate">{customer.preview ?? t("customerPreviewNone")}</Text>
                </span>
              </Link>
            ))}
          </section>
        ) : null}
      </nav>
    </>
  )
}
