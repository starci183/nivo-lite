import { MODULE_KEYS } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"

/** A suggestion to add something to the knowledge, never a requirement; its words live in the catalog (`knowledge` namespace). */
export interface DocumentIdea {
    readonly key: string
    /** Modules whose setup checklist this comes from; it shows when at least one is installed. */
    readonly modules: ReadonlyArray<ModuleKey>
    /** Business types it fits; omitted = any. */
    readonly businessTypes?: ReadonlyArray<string>
}

/** The suggestions, by the key their words are stored under (`suggest_<key>_topic`, `suggest_<key>_hint`). */
export const DOCUMENT_IDEAS: ReadonlyArray<DocumentIdea> = [
    { key: "about", modules: ["chatbot", "sales"] },
    { key: "offerings", modules: ["chatbot", "sales"] },
    { key: "faq", modules: ["chatbot"] },
    { key: "hours_location", modules: ["chatbot"] },
    {
        key: "policies",
        modules: ["chatbot", "sales"],
        businessTypes: ["retail", "services", "clinic", "education"],
    },
    { key: "who_handles", modules: ["chatbot", "sales"] },
    { key: "qualification", modules: ["sales"] },
    { key: "approval_process", modules: ["sales", "accounting"] },
    { key: "payment_methods", modules: ["accounting", "chatbot"] },
    { key: "invoicing_tax", modules: ["accounting"] },
    { key: "booking_services", modules: ["booking"] },
    { key: "booking_cancellation", modules: ["booking"] },
    { key: "booking_resources", modules: ["booking"] },
    { key: "booking_exceptions", modules: ["booking"] },
    { key: "loyalty_points", modules: ["loyalty"] },
    { key: "loyalty_rewards", modules: ["loyalty"] },
    { key: "loyalty_tiers", modules: ["loyalty"] },
    { key: "loyalty_expiry", modules: ["loyalty"] },
    { key: "inventory_suppliers", modules: ["inventory"] },
    { key: "inventory_reorder", modules: ["inventory"] },
    { key: "inventory_units", modules: ["inventory"] },
    { key: "inventory_counts", modules: ["inventory"] },
    { key: "shifts_positions", modules: ["shifts"] },
    { key: "shifts_rules", modules: ["shifts"] },
    { key: "shifts_leave", modules: ["shifts"] },
    { key: "shifts_busy_periods", modules: ["shifts"] },
    { key: "hiring_roles", modules: ["hiring"] },
    { key: "hiring_process", modules: ["hiring"] },
    { key: "hiring_benefits", modules: ["hiring"] },
    { key: "hiring_salary_bands", modules: ["hiring"] },
    { key: "content_pillars", modules: ["content"] },
    { key: "content_banned_claims", modules: ["content"] },
    { key: "content_offers_calendar", modules: ["content"] },
    { key: "content_channels_cadence", modules: ["content"] },
    { key: "video_brand_kit", modules: ["video"] },
    { key: "video_offers", modules: ["video"] },
    { key: "video_claims", modules: ["video"] },
    { key: "lead_icp", modules: ["lead_gen"] },
    { key: "lead_questions", modules: ["lead_gen"] },
    { key: "lead_scoring", modules: ["lead_gen"] },
    { key: "lead_objections", modules: ["lead_gen"] },
    { key: "lead_offers", modules: ["lead_gen"] },
    { key: "lead_forbidden_claims", modules: ["lead_gen"] },
    { key: "lead_routing", modules: ["lead_gen"] },
    { key: "brand_voice", modules: MODULE_KEYS },
]

/** How many of the installed agents an idea is for; a suggestion for every agent counts once, so it ranks after the specific ones. */
export const relevanceOf = (idea: DocumentIdea, installed: ReadonlyArray<ModuleKey>): number =>
    idea.modules.length >= MODULE_KEYS.length ? 0.5 : idea.modules.filter((module) => installed.includes(module)).length

/** The suggestions that fit the installed modules and the business type of the workspace, the most relevant to the installed agents first. */
export const ideasFor = (
    installed: ReadonlyArray<ModuleKey>,
    businessType: string | null,
): ReadonlyArray<DocumentIdea> =>
    [
        ...DOCUMENT_IDEAS.filter(
            (one) =>
                one.modules.some((module) => installed.includes(module)) &&
                (one.businessTypes === undefined || businessType === null || one.businessTypes.includes(businessType)),
        ),
    ].sort((a, b) => relevanceOf(b, installed) - relevanceOf(a, installed))

/** One question and its answer. */
export interface QaPair {
    readonly q: string
    readonly a: string
}

/** The words that label a question and an answer in the stored text. */
export interface QaLabels {
    readonly question: string
    readonly answer: string
}

/** The Q&A pairs of a list as text, so each pair stays in one passage. */
export const pairsToText = (pairs: ReadonlyArray<QaPair>, labels: QaLabels): string =>
    pairs
        .filter((pair) => pair.q.trim() !== "" && pair.a.trim() !== "")
        .map((pair) => `${labels.question}: ${pair.q.trim()}\n${labels.answer}: ${pair.a.trim()}`)
        .join("\n\n")
