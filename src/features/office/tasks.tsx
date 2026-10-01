"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { TileIcon } from "@/ui"
import { Badge, Button, EmptyNotice, Select, SurfaceListCard, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { office } from "@/i18n/dict/office"
import type { ResponsibilityStatus, ResponsibilityWithLead } from "@/lib/types"
import {
  FILTERS_CLASS_NAME,
  FILTER_CARD_CLASS_NAME,
  STACK_CLASS_NAME,
  TASK_MAIN_CLASS_NAME,
  TASK_ROW_CLASS_NAME,
  TASK_SIDE_CLASS_NAME,
  TASK_TITLE_CLASS_NAME,
} from "./classNames"
import { formatDay } from "./format"

const STATUS: Record<ResponsibilityStatus, { label: "statusOpen" | "statusWaiting" | "statusDone"; tone: "accent" | "warning" | "success" }> = {
  open: { label: "statusOpen", tone: "accent" },
  waiting_approval: { label: "statusWaiting", tone: "warning" },
  done: { label: "statusDone", tone: "success" },
}

const ALL = "all"

/** Props for {@link TasksPanel}. */
export type TasksPanelProps = { readonly items: ReadonlyArray<ResponsibilityWithLead> }

/** Tasks tab: owner and status filters over every responsibility, each row linking to its lead. */
export const TasksPanel = ({ items }: TasksPanelProps) => {
  const router = useRouter()
  const t = useT(office)
  const locale = useLocale()
  const [owner, setOwner] = useState(ALL)
  const [status, setStatus] = useState(ALL)

  const ownerOptions = useMemo(
    () => [{ id: ALL, label: t("allOwners") }, ...[...new Set(items.map((i) => i.owner_name))].map((name) => ({ id: name, label: name }))],
    [items, t],
  )
  const statusOptions = useMemo(
    () => [{ id: ALL, label: t("allStatuses") }, ...(Object.keys(STATUS) as Array<ResponsibilityStatus>).map((key) => ({ id: key, label: t(STATUS[key].label) }))],
    [t],
  )
  const visible = items.filter((i) => (owner === ALL || i.owner_name === owner) && (status === ALL || i.status === status))
  const isFiltered = owner !== ALL || status !== ALL

  return (
    <div className={STACK_CLASS_NAME}>
      <div className={FILTERS_CLASS_NAME}>
        <div className={FILTER_CARD_CLASS_NAME}>
          <Select label={t("filterOwner")} options={ownerOptions} value={owner} onValueChange={(value) => setOwner(value ?? ALL)} />
        </div>
        <div className={FILTER_CARD_CLASS_NAME}>
          <Select label={t("filterStatus")} options={statusOptions} value={status} onValueChange={(value) => setStatus(value ?? ALL)} />
        </div>
        {isFiltered ? (
          <Button variant="ghost" onPress={() => { setOwner(ALL); setStatus(ALL) }}>{t("clearFilters")}</Button>
        ) : null}
      </div>
      <SurfaceListCard
        label={t("tasksLabel")}
        headingLevel={2}
        fact={t("tasksFact", { shown: visible.length, total: items.length })}
        empty={
          items.length === 0 ? (
            <EmptyNotice message={t("noTasks")} description={t("noTasksHint")} actionLabel={t("openLeads")} actionVariant="secondary" onAction={() => router.push("/leads")} />
          ) : (
            <EmptyNotice message={t("noTasksMatch")} description={t("noTasksMatchHint")} actionLabel={t("clearFilters")} actionVariant="secondary" onAction={() => { setOwner(ALL); setStatus(ALL) }} />
          )
        }
      >
        {visible.map((item) => {
          const state = STATUS[item.status]
          return (
            <li key={item.id} className={TASK_ROW_CLASS_NAME}>
              <TileIcon props={{ icon: "review" }} />
              <div className={TASK_MAIN_CLASS_NAME}>
                <div className={TASK_TITLE_CLASS_NAME}>
                  <Text weight="semibold">{item.title}</Text>
                  <Badge tone={state.tone} isDot>{t(state.label)}</Badge>
                </div>
                <Text size="sm" tone="muted" overflow="clamp-2">{item.next_action}</Text>
                <Text size="sm" tone="muted">
                  {t("taskMeta", { lead: item.lead.contact_name, owner: item.owner_name, due: item.due_at ? t("due", { date: formatDay(item.due_at, locale) }) : t("noDue") })}
                </Text>
              </div>
              <div className={TASK_SIDE_CLASS_NAME}>
                <Button variant="outline" size="sm" href={`/leads/${item.lead_id}`}>{t("openArrow")}</Button>
              </div>
            </li>
          )
        })}
      </SurfaceListCard>
    </div>
  )
}
