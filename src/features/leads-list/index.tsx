"use client"

import { useMemo, useState } from "react"
import { Button, EmptyNotice, PageContainer, SearchField, SectionHeader, SurfaceCard, Tabs, TextAction } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { leads as leadsDict } from "@/i18n/dict/leads"
import type { LeadRow } from "@/lib/queries"
import type { LeadStage } from "@/lib/types"
import { LeadsPromoRow } from "@/features/promo-ads/LeadsPromoRow"
import { LeadListRow } from "./component"
import { FILTERS_CLASS, LIST_CLASS, PAGE_CLASS, SEARCH_CLASS, TABS_CLASS } from "./classNames"
import { NewLeadForm } from "./NewLeadForm"
import { STAGE_ORDER, STAGE_VIEW } from "./stage"

/** Props for {@link LeadsList}. */
export type LeadsListProps = {
  readonly leads: ReadonlyArray<LeadRow>
  readonly nowIso: string
  readonly initialQuery?: string
  readonly initialFormOpen?: boolean
}

const ALL = "all"

const isStage = (key: string): key is LeadStage => (STAGE_ORDER as ReadonlyArray<string>).includes(key)

/** Leads page body: header, filters, stage tabs, optional new-lead form and lead cards. */
export const LeadsList = ({ leads, nowIso, initialQuery = "", initialFormOpen = false }: LeadsListProps) => {
  const t = useT(leadsDict)
    const [query, setQuery] = useState(initialQuery)
  const [isFormOpen, setIsFormOpen] = useState(initialFormOpen)
  const [stage, setStage] = useState<string>(ALL)

  const baseMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter((l) => {
      if (q && !`${l.contact_name} ${l.company} ${l.need}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [leads, query])

  const counts = useMemo(() => {
    const byStage: Record<string, number> = { [ALL]: baseMatches.length }
    for (const l of baseMatches) byStage[l.stage] = (byStage[l.stage] ?? 0) + 1
    return byStage
  }, [baseMatches])

  const visible = useMemo(() => {
    const rows = stage === ALL ? baseMatches : baseMatches.filter((l) => l.stage === stage)
    const time = (l: LeadRow) => new Date(l.created_at).getTime()
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [baseMatches, stage])

  const isFiltered = query.trim() !== "" || stage !== ALL
  const onClear = () => {
    setQuery("")
    setStage(ALL)
  }

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader
          level={1}
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("descriptionShort")}
          action={isFormOpen ? undefined : <Button variant="primary" onPress={() => setIsFormOpen(true)}>{t("newLead")}</Button>}
        />
        {isFormOpen ? <NewLeadForm onCancel={() => setIsFormOpen(false)} /> : null}
        <div className={FILTERS_CLASS}>
          <div className={SEARCH_CLASS}>
            <SearchField label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={query} onValueChange={setQuery} onClear={() => setQuery("")} />
          </div>
          {isFiltered ? <TextAction onPress={onClear}>{t("clearFilters")}</TextAction> : null}
        </div>
        <div className={TABS_CLASS}>
          <Tabs
            label={t("tabsLabel")}
            selectedKey={stage}
            inset="none"
            labelVisibility="always"
            items={[{ id: ALL, label: t("tabAll", { n: counts[ALL] ?? 0 }) }, ...STAGE_ORDER.map((s) => ({ id: s, label: t("tabStage", { stage: t(STAGE_VIEW[s].key), n: counts[s] ?? 0 }) }))]}
            onSelect={(key) => setStage(key === ALL || isStage(key) ? key : ALL)}
          />
        </div>
        {visible.length === 0 ? (
          <SurfaceCard ariaLabel={t("emptyAria")}>
            {leads.length === 0 ? (
              <EmptyNotice message={t("emptyTitle")} description={t("emptyBody")} actionLabel={t("newLead")} actionVariant="secondary" onAction={() => setIsFormOpen(true)} />
            ) : (
              <EmptyNotice message={t("noMatchTitle")} description={t("noMatchBody")} actionLabel={t("clearFilters")} actionVariant="secondary" onAction={onClear} />
            )}
          </SurfaceCard>
        ) : (
          <SurfaceCard ariaLabel={t("listAria")}>
          <ul className={LIST_CLASS}>
            {visible.map((lead) => <LeadListRow key={lead.id} lead={lead} nowIso={nowIso} />)}
          </ul>
          </SurfaceCard>
        )}
        {visible.length > 0 ? <LeadsPromoRow /> : null}
      </div>
    </PageContainer>
  )
}
