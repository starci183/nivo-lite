"use client"

import { useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { FILTER_OFF_CLASS, FILTER_ON_CLASS, FILTERS_CLASS } from "./classNames"
import { useLocale } from "@/i18n/client"
import { isModuleKey, moduleDef, pick } from "@/lib/module-registry"
import type { AutomationCardView } from "@/lib/automation-shared"
import { filtersFor, type FilterKey } from "./helpers"

const LABEL = {
  all: "filterAll", chatbot: "filterChatbot", sales: "filterSales", accounting: "filterAccounting", workspace: "filterWorkspace", on: "filterOn",
} as const

/** Props for {@link AutomationsFilters}. */
export type AutomationsFiltersProps = { readonly value: FilterKey; readonly onChange: (f: FilterKey) => void; readonly cards: ReadonlyArray<AutomationCardView> }

/** The filter chips: all, one per module, the whole workspace, and what is switched on. */
export const AutomationsFilters = ({ value, onChange, cards }: AutomationsFiltersProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const labelOf = (f: FilterKey): string => (f in LABEL ? t(LABEL[f as keyof typeof LABEL]) : isModuleKey(f) ? pick(moduleDef(f).name, locale) : f)
  return (
    <div className={FILTERS_CLASS} role="group" aria-label={t("filtersLabel")}>
      {filtersFor(cards).map((f) => (
        <button key={f} type="button" aria-pressed={value === f} className={value === f ? FILTER_ON_CLASS : FILTER_OFF_CLASS} onClick={() => onChange(f)}>{labelOf(f)}</button>
      ))}
    </div>
  )
}
