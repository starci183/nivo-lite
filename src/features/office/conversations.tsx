"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Badge, Button, IconTile, List, ListBox, ListRow, SearchField, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/ui"
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { Agent, Message } from "@/lib/types"
import {
  COLUMN_HEAD_CLASS_NAME,
  HEAD_TEXT_CLASS_NAME,
  LIST_BODY_CLASS_NAME,
  LIST_CAPTION_CLASS_NAME,
  LIST_SEARCH_CLASS_NAME,
  LIST_SECTION_CLASS_NAME,
  LIST_TRAILING_CLASS_NAME,
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
  /** STATE-8: the list keeps its title, search and section caption, its rows are three skeleton rows. */
  readonly isLoading?: boolean
}

const contains = (text: string, query: string) => text.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))

/** Left column: the Office group chat, each agent (1:1 chat) and recent customers, with search. */
export const ConversationList = ({ groupName, messages, agents, customers, pendingCount, nowIso, onOpenGroup, isLoading = false }: ConversationListProps) => {
  const t = useT(office)
  const locale = useLocale()
  const router = useRouter()
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
      {isLoading ? (
        <nav className={LIST_BODY_CLASS_NAME} aria-label={t("listLabel")} aria-busy="true">
          <section className={LIST_SECTION_CLASS_NAME} aria-label={t("sectionGroups")}>
            <div className={LIST_CAPTION_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("sectionGroups")}</Text>
            </div>
            <List label={t("sectionGroups")}>
              {[0, 1, 2].map((n) => <ListRow key={n} isSkeleton title={t("title")} description={t("groupPreviewEmpty")} leading={<span />} />)}
            </List>
          </section>
        </nav>
      ) : (
      <nav className={LIST_BODY_CLASS_NAME} aria-label={t("listLabel")}>
        {isEmpty ? <Text size="sm" tone="muted">{t("noMatches", { q })}</Text> : null}
        {/* Each section is a Grammar ListBox: rows, selection face, focus and keyboard model are its own (SURFACE-4, FOCUS-2). */}
        {showGroup ? (
          <section className={LIST_SECTION_CLASS_NAME} aria-label={t("sectionGroups")}>
            <div className={LIST_CAPTION_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("sectionGroups")}</Text>
            </div>
            <ListBox
              label={t("sectionGroups")}
              selectionMode="single"
              selectedIds={["group"]}
              onSelectionChange={() => onOpenGroup()}
              items={[
                {
                  id: "group",
                  label: t("title"),
                  description: groupPreview,
                  leading: <IconTile source={nivoIconSource("community", "leading")} tone="neutral" size="sm" />,
                  trailing: (
                    <span className={LIST_TRAILING_CLASS_NAME}>
                      {last ? <Text size="xs" tone="muted">{listTime(last.created_at, nowIso, locale, words)}</Text> : null}
                      {pendingCount > 0 ? <Badge tone="accent">{pendingCount}</Badge> : null}
                    </span>
                  ),
                },
              ]}
            />
          </section>
        ) : null}
        {shownAgents.length ? (
          <section className={LIST_SECTION_CLASS_NAME} aria-label={t("sectionAgents")}>
            <div className={LIST_CAPTION_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("sectionAgents")}</Text>
            </div>
            <ListBox
              label={t("sectionAgents")}
              selectionMode="none"
              onAction={(id) => router.push(`/modules/${id}/chat`)}
              items={shownAgents.map((agent) => {
                const said = lastByAgent(agent.id)
                const isActive = agent.status === "active"
                return {
                  id: agent.id,
                  label: agent.name,
                  description: isActive ? (said?.body ?? agent.role) : t("agentPreviewPaused"),
                  leading: <AgentAvatar module={agent.module} label={agent.name} online={isActive} />,
                  trailing: said ? <Text size="xs" tone="muted">{listTime(said.created_at, nowIso, locale, words)}</Text> : undefined,
                }
              })}
            />
          </section>
        ) : null}
        {shownCustomers.length ? (
          <section className={LIST_SECTION_CLASS_NAME} aria-label={t("sectionCustomers")}>
            <div className={LIST_CAPTION_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("sectionCustomers")}</Text>
              <Button variant="ghost" size="sm" href="/leads">{t("allCustomers")}</Button>
            </div>
            <ListBox
              label={t("sectionCustomers")}
              selectionMode="none"
              onAction={(id) => router.push(`/leads/${id}`)}
              items={shownCustomers.map((customer) => ({
                id: customer.id,
                label: customer.name,
                description: customer.preview ?? t("customerPreviewNone"),
                leading: <PersonAvatar name={customer.name} />,
                trailing: <Text size="xs" tone="muted">{listTime(customer.at, nowIso, locale, words)}</Text>,
              }))}
            />
          </section>
        ) : null}
      </nav>
      )}
    </>
  )
}
