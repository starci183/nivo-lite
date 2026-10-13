import type { AutomationCardView, AutomationRunView, Capability, L, ShopContext, TemplateDef } from "@/lib/automation-shared"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { buildCards, runViewsOf } from "./automations.cards"
import type { RequirementLabels } from "./automations.cards"
import { capabilitiesFrom, contextsFrom, factsFrom, shopContextFrom } from "./automations.context"
import type { PatternCapability, ShopPatterns } from "./automations.context"
import type { OverviewRows } from "./automations.rows"

/** The gallery as the screen shows it. */
export interface AutomationsView {
    readonly cards: ReadonlyArray<AutomationCardView>
    readonly runs: ReadonlyArray<AutomationRunView>
    readonly shop: ShopContext
    /** The Google accounts a spreadsheet automation can write with. */
    readonly accounts: ReadonlyArray<GoogleAccount>
}

/** One connected Google account of the workspace. */
export interface GoogleAccount {
    readonly id: string
    readonly name: string
    readonly status: "connected" | "error"
}

/** A translator of one language over the automations messages. */
export type AutomationsTexts = (key: string, values?: Readonly<Record<string, string>>) => string

/** The two languages the labels are written in. */
export interface AutomationsLanguages {
    readonly vi: AutomationsTexts
    readonly en: AutomationsTexts
}

const CAPABILITY_LABEL_KEYS: Readonly<Record<Capability, string>> = {
    has_opening_hours: "missingCapabilityHasOpeningHours",
    has_deposits: "missingCapabilityHasDeposits",
    has_due_dates: "missingCapabilityHasDueDates",
    has_appointments: "missingCapabilityHasAppointments",
    sells_online: "missingCapabilitySellsOnline",
    has_recurring_contracts: "missingCapabilityHasRecurringContracts",
    has_delivery: "missingCapabilityHasDelivery",
}

const PATTERN_KEYS: Readonly<Record<PatternCapability, string>> = {
    has_deposits: "patternHasDeposits",
    has_appointments: "patternHasAppointments",
    sells_online: "patternSellsOnline",
    has_recurring_contracts: "patternHasRecurringContracts",
    has_delivery: "patternHasDelivery",
}

const both = (languages: AutomationsLanguages, key: string, values?: Readonly<Record<string, string>>): L => ({
    vi: languages.vi(key, values),
    en: languages.en(key, values),
})

const moduleName = (key: string, locale: "vi" | "en"): string => (isModuleKey(key) ? MODULE_REGISTRY[key].name[locale] : key)

/** The language data that reads a shop, compiled from the Vietnamese messages. */
export const patternsFrom = (texts: AutomationsTexts): ShopPatterns => ({
    capabilities: {
        has_deposits: new RegExp(texts(PATTERN_KEYS.has_deposits), "i"),
        has_appointments: new RegExp(texts(PATTERN_KEYS.has_appointments), "i"),
        sells_online: new RegExp(texts(PATTERN_KEYS.sells_online), "i"),
        has_recurring_contracts: new RegExp(texts(PATTERN_KEYS.has_recurring_contracts), "i"),
        has_delivery: new RegExp(texts(PATTERN_KEYS.has_delivery), "i"),
    },
    due: new RegExp(texts("patternDue"), "i"),
    hoursLine: new RegExp(texts("patternHoursLine"), "i"),
    negation: new RegExp(texts("patternNegation"), "i"),
})

/** The labels of the missing requirements, in both languages. */
const labelsFrom = (languages: AutomationsLanguages): RequirementLabels => ({
    module: (key) => ({
        vi: languages.vi("missingModule", { name: moduleName(key, "vi") }),
        en: languages.en("missingModule", { name: moduleName(key, "en") }),
    }),
    channel: () => both(languages, "missingChannelCustomerChat"),
    connection: (key) => both(languages, `missingConnection${key.charAt(0).toUpperCase()}${key.slice(1)}`),
    capability: (key) => both(languages, CAPABILITY_LABEL_KEYS[key]),
})

/** Everything the automations screen shows, assembled from the rows of `automations_data` and the templates of the catalogue. */
export const assembleAutomations = (
    rows: OverviewRows,
    templates: ReadonlyArray<TemplateDef>,
    languages: AutomationsLanguages,
): AutomationsView => {
    const contexts = contextsFrom(rows.installations)
    const patterns = patternsFrom(languages.vi)
    const capabilities = capabilitiesFrom(rows, contexts, patterns)
    const runs = runViewsOf(rows.runs, rows.pipelines)
    const cards = buildCards({
        rows,
        templates,
        contexts,
        facts: factsFrom(rows, contexts, capabilities),
        runs,
        labels: labelsFrom(languages),
    })
    const { shop, hours, tone } = shopContextFrom(rows.workspace_name, rows.authority, contexts, patterns)
    return { cards, runs, shop: { shop, hours, tone }, accounts: [] }
}
