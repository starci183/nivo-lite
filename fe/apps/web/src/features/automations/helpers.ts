import type { IconName } from "@/ui"
import type { AutomationCardView, L, ModuleScope, TemplateDef } from "@/lib/automation-shared"
import type { Locale } from "@/i18n/core"
import { listModules } from "@/lib/module-registry"

export const loc = (l: L, locale: Locale): string => l[locale]

/** Template icon word -> the app's glyph names. */
const ICONS: Record<TemplateDef["icon"], IconName> = {
  payment: "wallet", leads: "account", report: "overview", review: "review", debt: "credit", winback: "retry",
  moon: "dark", sheet: "blog", calendar: "streak", cart: "cart", contract: "saved", truck: "servers", receipt: "wallet", ledger: "saved",
}
export const iconFor = (def: TemplateDef): IconName => ICONS[def.icon] ?? "apps"

export type ScopeKey = ModuleScope | "workspace"
export const scopeOf = (def: TemplateDef): ScopeKey => def.moduleKey ?? "workspace"

export type CardStatus = "running" | "off" | "soon" | "needsGoogle" | "needsWebhook" | "needsEmail" | "googleLost" | "googleUnavailable" | "missing"

/** The one fact the card shows as its badge. */
export const statusOf = (c: AutomationCardView): CardStatus => {
  if (c.comingSoon) return "soon"
  if (c.google === "unavailable") return "googleUnavailable"
  if (c.google === "lost") return "googleLost"
  if (c.missing.length === 1 && c.missing[0].kind === "connection") return c.missing[0].key === "webhook" ? "needsWebhook" : c.missing[0].key === "smtp" ? "needsEmail" : "needsGoogle"
  if (c.missing.length > 0) return "missing"
  return c.enabled ? "running" : "off"
}

/** A card the switch cannot toggle by itself. */
export const switchLocked = (s: CardStatus): boolean => s === "soon" || s === "missing" || s === "googleUnavailable"
/** A card whose switch starts a connection instead of toggling. */
export const startsConnection = (s: CardStatus): boolean => s === "needsGoogle" || s === "needsWebhook" || s === "needsEmail" || s === "googleLost"

export type FilterKey = "all" | ModuleScope | "workspace" | "on"
/** The filter chips: all, the stable modules, the whole workspace, what is on; plus any other module that owns at least one card (see filtersFor). */
export const FILTERS: ReadonlyArray<FilterKey> = ["all", ...listModules().filter((m) => m.status === "stable").map((m) => m.key), "workspace", "on"]
export const filtersFor = (cards: ReadonlyArray<AutomationCardView>): ReadonlyArray<FilterKey> => {
  const extra = listModules().filter((m) => m.status !== "stable" && cards.some((c) => scopeOf(c.def) === m.key)).map((m) => m.key as FilterKey)
  return extra.length === 0 ? FILTERS : [...FILTERS.slice(0, FILTERS.indexOf("workspace")), ...extra, ...FILTERS.slice(FILTERS.indexOf("workspace"))]
}

export const matchesFilter = (c: AutomationCardView, f: FilterKey): boolean => (f === "all" ? true : f === "on" ? c.enabled : scopeOf(c.def) === f)

/** Cards that are shown (the shop may have them) and not hidden by the owner. */
export const visibleCards = (cards: ReadonlyArray<AutomationCardView>): Array<AutomationCardView> => cards.filter((c) => c.proposed && !c.dismissed)
export const hiddenCards = (cards: ReadonlyArray<AutomationCardView>): Array<AutomationCardView> => cards.filter((c) => c.proposed && c.dismissed)
