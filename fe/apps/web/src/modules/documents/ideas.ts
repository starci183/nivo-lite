import { MODULE_KEYS } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import type { DocumentVisibility } from "@/modules/types"

/** A suggestion to add something to the knowledge, never a requirement; its words live in the catalog (`knowledge` namespace). */
export interface DocumentIdea {
    readonly key: string
    /** Modules whose setup checklist this comes from; it shows when at least one is installed. */
    readonly modules: ReadonlyArray<ModuleKey>
    /** Business types it fits; omitted = any. */
    readonly businessTypes?: ReadonlyArray<string>
    /** Whether the content is normally safe for customers to see. */
    readonly visibility: DocumentVisibility
}

/** The suggestions, by the key their words are stored under (`suggest_<key>_topic`, `suggest_<key>_hint`). */
export const DOCUMENT_IDEAS: ReadonlyArray<DocumentIdea> = [
    { key: "about", modules: ["chatbot", "sales"], visibility: "public" },
    { key: "offerings", modules: ["chatbot", "sales"], visibility: "public" },
    { key: "faq", modules: ["chatbot"], visibility: "public" },
    { key: "hours_location", modules: ["chatbot"], visibility: "public" },
    {
        key: "policies",
        modules: ["chatbot", "sales"],
        businessTypes: ["retail", "services", "clinic", "education"],
        visibility: "public",
    },
    { key: "who_handles", modules: ["chatbot", "sales"], visibility: "internal" },
    { key: "qualification", modules: ["sales"], visibility: "internal" },
    { key: "approval_process", modules: ["sales", "accounting"], visibility: "internal" },
    { key: "payment_methods", modules: ["accounting", "chatbot"], visibility: "internal" },
    { key: "invoicing_tax", modules: ["accounting"], visibility: "internal" },
    { key: "booking_services", modules: ["booking"], visibility: "public" },
    { key: "booking_cancellation", modules: ["booking"], visibility: "public" },
    { key: "booking_resources", modules: ["booking"], visibility: "internal" },
    { key: "booking_exceptions", modules: ["booking"], visibility: "public" },
    { key: "loyalty_points", modules: ["loyalty"], visibility: "public" },
    { key: "loyalty_rewards", modules: ["loyalty"], visibility: "public" },
    { key: "loyalty_tiers", modules: ["loyalty"], visibility: "public" },
    { key: "loyalty_expiry", modules: ["loyalty"], visibility: "public" },
    { key: "inventory_suppliers", modules: ["inventory"], visibility: "internal" },
    { key: "inventory_reorder", modules: ["inventory"], visibility: "internal" },
    { key: "inventory_units", modules: ["inventory"], visibility: "internal" },
    { key: "inventory_counts", modules: ["inventory"], visibility: "internal" },
    { key: "shifts_positions", modules: ["shifts"], visibility: "internal" },
    { key: "shifts_rules", modules: ["shifts"], visibility: "internal" },
    { key: "shifts_leave", modules: ["shifts"], visibility: "internal" },
    { key: "shifts_busy_periods", modules: ["shifts"], visibility: "internal" },
    { key: "hiring_roles", modules: ["hiring"], visibility: "public" },
    { key: "hiring_process", modules: ["hiring"], visibility: "internal" },
    { key: "hiring_benefits", modules: ["hiring"], visibility: "internal" },
    { key: "hiring_salary_bands", modules: ["hiring"], visibility: "internal" },
    { key: "content_pillars", modules: ["content"], visibility: "internal" },
    { key: "content_banned_claims", modules: ["content"], visibility: "internal" },
    { key: "content_offers_calendar", modules: ["content"], visibility: "internal" },
    { key: "content_channels_cadence", modules: ["content"], visibility: "internal" },
    { key: "video_brand_kit", modules: ["video"], visibility: "internal" },
    { key: "video_offers", modules: ["video"], visibility: "public" },
    { key: "video_claims", modules: ["video"], visibility: "internal" },
    { key: "lead_icp", modules: ["lead_gen"], visibility: "internal" },
    { key: "lead_questions", modules: ["lead_gen"], visibility: "internal" },
    { key: "lead_scoring", modules: ["lead_gen"], visibility: "internal" },
    { key: "lead_objections", modules: ["lead_gen"], visibility: "internal" },
    { key: "lead_offers", modules: ["lead_gen"], visibility: "public" },
    { key: "lead_forbidden_claims", modules: ["lead_gen"], visibility: "internal" },
    { key: "lead_routing", modules: ["lead_gen"], visibility: "internal" },
    { key: "brand_voice", modules: MODULE_KEYS, visibility: "internal" },
]

/** The suggestions that fit the installed modules and the business type of the workspace. */
export const ideasFor = (
    installed: ReadonlyArray<ModuleKey>,
    businessType: string | null,
): ReadonlyArray<DocumentIdea> =>
    DOCUMENT_IDEAS.filter(
        (one) =>
            one.modules.some((module) => installed.includes(module)) &&
            (one.businessTypes === undefined || businessType === null || one.businessTypes.includes(businessType)),
    )

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
