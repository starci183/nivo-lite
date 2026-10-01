"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { answerAutoSend, dismissAutomation, saveAutomation, toggleAutomation } from "@/lib/automation-actions"
import type { AutomationCardView, ConfigValue, ModuleScope } from "@/lib/automation-shared"
import { startGoogleConnect } from "@/lib/google-actions"
import { AutomationCard } from "./AutomationCard"
import { AutomationDetail } from "./AutomationDetail"
import { AutomationsFilters } from "./AutomationsFilters"
import { GRID_CLASS, GRID_WIDE_CLASS, LAYOUT_CLASS, LIST_CLASS, SOLO_CLASS } from "./classNames"
import { HiddenList } from "./HiddenList"
import { hiddenCards, matchesFilter, scopeOf, startsConnection, statusOf, visibleCards, type FilterKey } from "./helpers"
import { useAutomations, type AutomationsData } from "./useAutomations"

/** Props for {@link AutomationsBoard}. */
export type AutomationsBoardProps = {
  readonly initial: AutomationsData
  /** "page": filters and a grid with the detail beside it. "module": one module's cards as a compact list, detail below. */
  readonly layout: "page" | "module"
  readonly moduleKey?: ModuleScope
  readonly focus?: string
}

/** The cards, their switches and the detail panel. Shared by /automations and the module Settings section. */
export const AutomationsBoard = ({ initial, layout, moduleKey, focus }: AutomationsBoardProps) => {
  const t = useT(dict)
  const router = useRouter()
  const { cards, runs, shop, busyKey, error, setError, apply } = useAutomations(initial)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [selected, setSelected] = useState<string | null>(focus ?? null)
  const [awaiting, setAwaiting] = useState<string | null>(null)

  const scoped = cards.filter((c) => (moduleKey ? scopeOf(c.def) === moduleKey : true))
  const shown = visibleCards(scoped).filter((c) => matchesFilter(c, filter))
  const hidden = hiddenCards(scoped)
  const current = visibleCards(scoped).find((c) => c.key === selected) ?? null

  useEffect(() => {
    if (selected) document.getElementById("automation-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [selected])

  const select = (key: string) => {
    setError(null)
    setAwaiting(null)
    setSelected((prev) => (prev === key ? null : key))
  }

  const toggle = async (card: AutomationCardView, next: boolean) => {
    const status = statusOf(card)
    if (startsConnection(status)) {
      if (status === "needsWebhook") return router.push("/developers")
      const r = await startGoogleConnect(`/automations?focus=${card.key}`)
      if (!r.ok) return setError(r.error)
      return window.location.assign(r.data.url)
    }
    if (next && card.def.defaultBody && card.body === null) {
      setError(null)
      setSelected(card.key)
      return setAwaiting(card.key)
    }
    await apply(card.key, () => toggleAutomation(card.key, next))
  }

  const saveAndEnable = async (card: AutomationCardView, body: string) => {
    const saved = await apply(card.key, () => saveAutomation(card.key, { body }))
    if (!saved) return false
    setAwaiting(null)
    return apply(card.key, () => toggleAutomation(card.key, true))
  }

  const detail = current ? (
    <AutomationDetail
      key={current.key}
      card={current}
      runs={runs.filter((r) => r.templateKey === current.key)}
      shop={shop}
      busy={busyKey === current.key}
      error={error}
      awaitingMessage={awaiting === current.key && current.body === null}
      onClose={() => setSelected(null)}
      onSaveValues={(values: Record<string, ConfigValue>) => apply(current.key, () => saveAutomation(current.key, { values }))}
      onSaveBody={(body) => apply(current.key, () => saveAutomation(current.key, { body }))}
      onSaveAndEnable={(body) => saveAndEnable(current, body)}
      onAnswerTrust={(accept) => void apply(current.key, () => answerAutoSend(current.key, accept))}
      onDismiss={() => void apply(current.key, () => dismissAutomation(current.key, true)).then((ok) => ok && setSelected(null))}
      onError={setError}
    />
  ) : null

  const list = shown.length === 0 ? (
    <Text size="sm" tone="muted">{filter === "all" ? (layout === "module" ? t("moduleEmpty") : t("emptyAll")) : t("emptyFiltered")}</Text>
  ) : (
    <div className={layout === "module" ? LIST_CLASS : current ? GRID_CLASS : GRID_WIDE_CLASS}>
      {shown.map((c) => (
        <AutomationCard key={c.key} card={c} selected={c.key === selected} busy={busyKey === c.key} onSelect={() => select(c.key)} onToggle={(next) => void toggle(c, next)} />
      ))}
    </div>
  )

  return (
    <>
      {layout === "page" ? <AutomationsFilters value={filter} onChange={setFilter} /> : null}
      {error && !current ? <Alert title={error} tone="negative" dismissLabel={t("detailClose")} onDismiss={() => setError(null)} /> : null}
      {layout === "page" ? (
        <div className={current ? LAYOUT_CLASS : SOLO_CLASS}>
          <div className="flex min-w-0 flex-col gap-4">{list}</div>
          {detail}
        </div>
      ) : <>{list}{detail}</>}
      <HiddenList cards={hidden} busyKey={busyKey} onRestore={(key) => void apply(key, () => dismissAutomation(key, false))} />
    </>
  )
}
