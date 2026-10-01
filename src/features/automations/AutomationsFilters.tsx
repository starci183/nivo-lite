"use client"

import { useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { FILTER_OFF_CLASS, FILTER_ON_CLASS, FILTERS_CLASS } from "./classNames"
import { FILTERS, type FilterKey } from "./helpers"

const LABEL = {
  all: "filterAll", chatbot: "filterChatbot", sales: "filterSales", accounting: "filterAccounting", workspace: "filterWorkspace", on: "filterOn",
} as const

/** Props for {@link AutomationsFilters}. */
export type AutomationsFiltersProps = { readonly value: FilterKey; readonly onChange: (f: FilterKey) => void }

/** The filter chips: all, one per module, the whole workspace, and what is switched on. */
export const AutomationsFilters = ({ value, onChange }: AutomationsFiltersProps) => {
  const t = useT(dict)
  return (
    <div className={FILTERS_CLASS} role="group" aria-label={t("filtersLabel")}>
      {FILTERS.map((f) => (
        <button key={f} type="button" aria-pressed={value === f} className={value === f ? FILTER_ON_CLASS : FILTER_OFF_CLASS} onClick={() => onChange(f)}>{t(LABEL[f])}</button>
      ))}
    </div>
  )
}
