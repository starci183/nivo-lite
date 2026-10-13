import { MODULE_KEYS, MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import type { AutomationCardView, ConfigValue, ModuleScope, TemplateDef } from "@/modules/types"

/** A text in both languages as the definitions carry it. */
type Localized = { readonly vi: string; readonly en: string }

/** The reader language of the product. */
type CopyLocale = "vi" | "en"

/** The text of a definition in the reader language. */
export const automationText = (text: Localized, locale: CopyLocale): string => text[locale]

/** The scope key of the whole workspace. */
const WORKSPACE_SCOPE = "workspace"

/** The module a card belongs to, or the workspace. */
export type AutomationScope = ModuleScope | typeof WORKSPACE_SCOPE

/** Where a template belongs. */
export const automationScopeOf = (def: TemplateDef): AutomationScope => def.moduleKey ?? WORKSPACE_SCOPE

/** The one fact a card shows as its badge. */
export type AutomationStatus =
    | "running"
    | "off"
    | "soon"
    | "needsGoogle"
    | "needsWebhook"
    | "needsEmail"
    | "googleLost"
    | "googleUnavailable"
    | "missing"

const CONNECTION_STATUS: Readonly<Record<string, AutomationStatus>> = { webhook: "needsWebhook", smtp: "needsEmail" }

const onlyConnection = (card: AutomationCardView): string | null => {
    const [first] = card.missing
    return card.missing.length === 1 && first?.kind === "connection" ? first.key : null
}

const settledStatus = (card: AutomationCardView): AutomationStatus => {
    if (card.missing.length > 0) return "missing"
    return card.enabled ? "running" : "off"
}

/** The badge of a card. */
export const automationStatusOf = (card: AutomationCardView): AutomationStatus => {
    if (card.comingSoon) return "soon"
    if (card.google === "unavailable") return "googleUnavailable"
    if (card.google === "lost") return "googleLost"
    const connection = onlyConnection(card)
    return connection === null ? settledStatus(card) : (CONNECTION_STATUS[connection] ?? "needsGoogle")
}

/** A card the switch cannot toggle by itself. */
export const isSwitchLocked = (status: AutomationStatus): boolean =>
    status === "soon" || status === "missing" || status === "googleUnavailable"

/** A card whose switch starts a connection instead of toggling. */
export const startsAutomationConnection = (status: AutomationStatus): boolean =>
    status === "needsGoogle" || status === "needsWebhook" || status === "needsEmail" || status === "googleLost"

/** One chip of the filter: all, a module, the whole workspace, or what is on. */
export type AutomationFilterKey = "all" | ModuleScope | typeof WORKSPACE_SCOPE | "on"

const MODULES = MODULE_KEYS.map((key) => MODULE_REGISTRY[key])

const STABLE_MODULES: ReadonlyArray<ModuleKey> = MODULES.filter((module) => module.status === "stable").map(
    (module) => module.key,
)

/** The chips that always show: all, the stable modules, the whole workspace, what is on. */
const BASE_FILTERS: ReadonlyArray<AutomationFilterKey> = ["all", ...STABLE_MODULES, WORKSPACE_SCOPE, "on"]

/** The chips for these cards: the base chips plus any other module that owns a card. */
export const automationFiltersFor = (cards: ReadonlyArray<AutomationCardView>): ReadonlyArray<AutomationFilterKey> => {
    const extra = MODULES.filter(
        (module) => module.status !== "stable" && cards.some((card) => automationScopeOf(card.def) === module.key),
    ).map((module): AutomationFilterKey => module.key)
    const at = BASE_FILTERS.indexOf(WORKSPACE_SCOPE)
    return [...BASE_FILTERS.slice(0, at), ...extra, ...BASE_FILTERS.slice(at)]
}

/** Whether a card passes the chip. */
export const matchesAutomationFilter = (card: AutomationCardView, filter: AutomationFilterKey): boolean => {
    if (filter === "all") return true
    return filter === "on" ? card.enabled : automationScopeOf(card.def) === filter
}

/** Cards that are shown (the shop may have them) and not hidden by the owner. */
export const visibleAutomations = (cards: ReadonlyArray<AutomationCardView>): Array<AutomationCardView> =>
    cards.filter((card) => card.proposed && !card.dismissed)

/** Cards the owner hid with "not for me". */
export const hiddenAutomations = (cards: ReadonlyArray<AutomationCardView>): Array<AutomationCardView> =>
    cards.filter((card) => card.proposed && card.dismissed)

/** The values of the settings of a card, as the form edits them. */
export type AutomationValues = Record<string, ConfigValue>

/** The module a filter chip names, or null for the chips that are not a module. */
export const moduleOfAutomationFilter = (filter: AutomationFilterKey): ModuleKey | null =>
    isModuleKey(filter) ? filter : null

/** The hours and minutes of a `HH:MM` setting. */
export const automationTimeParts = (
    value: ConfigValue | undefined,
): { readonly hour: number; readonly minute: number } => {
    const [hour, minute] = String(value ?? "00:00")
        .split(":")
        .map(Number)
    return { hour: Number.isFinite(hour) ? Number(hour) : 0, minute: Number.isFinite(minute) ? Number(minute) : 0 }
}
