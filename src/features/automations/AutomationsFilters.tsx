"use client"

import { TagGroup } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { isModuleKey, moduleDef, pick } from "@/lib/module-registry"
import type { AutomationCardView } from "@/lib/automation-shared"
import { filtersFor, type FilterKey } from "./helpers"

const LABEL = {
  all: "filterAll", chatbot: "filterChatbot", sales: "filterSales", accounting: "filterAccounting", workspace: "filterWorkspace", on: "filterOn",
} as const

/** Props for {@link AutomationsFilters}. */
export type AutomationsFiltersProps = { readonly value: FilterKey; readonly onChange: (f: FilterKey) => void; readonly cards: ReadonlyArray<AutomationCardView> }

/** The filter chips (Grammar TagGroup, single selection): all, one per module, the whole workspace, and what is switched on. */
export const AutomationsFilters = ({ value, onChange, cards }: AutomationsFiltersProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const filters = filtersFor(cards)
  const labelOf = (f: FilterKey): string => (f in LABEL ? t(LABEL[f as keyof typeof LABEL]) : isModuleKey(f) ? pick(moduleDef(f).name, locale) : f)
  return (
    <TagGroup
      label={t("filtersLabel")}
      selectionMode="single"
      items={filters.map((f) => ({ id: f, label: labelOf(f) }))}
      selectedIds={[value]}
      onSelectionChange={(ids) => {
        // A chip is never deselected by pressing it again: an empty selection keeps the current filter.
        const next = filters.find((f) => f === ids[0])
        if (next) onChange(next)
      }}
    />
  )
}
