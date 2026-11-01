import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import type {
    Connection,
    ConnectorAudience,
    ConnectorCategory,
    ConnectorGlyph,
    ConnectorStatus,
    Provider,
} from "@/modules/types"

/** One connector of the library as data. Its words are catalog keys (`catalogKey`), never strings. */
export interface CatalogEntry {
    readonly id: string
    readonly category: ConnectorCategory
    readonly status: ConnectorStatus
    readonly audience: ReadonlyArray<ConnectorAudience>
    /** Higher first in "Popular". */
    readonly popularity: number
    /** Set when the app can set it up today. */
    readonly provider?: Provider
    readonly glyph: ConnectorGlyph
    /** Artwork for a connector that is not a provider yet (a provider logo comes from the provider registry). */
    readonly logo?: string
}

/** The categories, in display order. */
export const CATEGORIES: ReadonlyArray<ConnectorCategory> = [
    "payments",
    "chat",
    "commerce",
    "accounting",
    "data",
    "email",
    "productivity",
    "automation",
]

const real = (
    provider: Provider,
    category: ConnectorCategory,
    audience: ReadonlyArray<ConnectorAudience>,
    popularity: number,
    glyph: ConnectorGlyph,
): CatalogEntry => ({
    id: provider,
    category,
    status: PROVIDERS[provider].earlyAccess === true ? "early" : "official",
    audience,
    popularity,
    provider,
    glyph,
})

const soon = (
    id: string,
    category: ConnectorCategory,
    audience: ReadonlyArray<ConnectorAudience>,
    popularity: number,
    glyph: ConnectorGlyph,
    logo?: string,
): CatalogEntry => ({
    id,
    category,
    status: "soon",
    audience,
    popularity,
    glyph,
    ...(logo === undefined ? {} : { logo }),
})

/** Every connector of the library. Adding the next one is one line here and its words in the catalog. */
export const CATALOG: ReadonlyArray<CatalogEntry> = [
    real("sepay", "payments", ["accounting"], 100, "wallet"),
    real("payos", "payments", ["accounting"], 70, "wallet"),
    real("casso", "payments", ["accounting"], 60, "wallet"),
    real("telegram", "chat", ["chatbot", "sales"], 95, "community"),
    real("zalo_oa", "chat", ["chatbot", "sales"], 98, "community"),
    real("meta", "chat", ["chatbot", "sales"], 97, "community"),
    real("telegram_user", "chat", ["any"], 55, "community"),
    real("database", "data", ["any"], 65, "servers"),
    real("openapi", "data", ["any"], 62, "code"),
    real("csv_import", "data", ["any"], 90, "apps"),
    real("imap", "email", ["any"], 75, "email"),
    real("smtp", "email", ["accounting", "sales"], 58, "email"),
    real("google", "productivity", ["sales"], 80, "apps"),
    real("google_drive", "productivity", ["any"], 61, "apps"),
    real("webhook", "automation", ["any"], 50, "trigger"),
    soon("tiktok_chat", "chat", ["chatbot"], 60, "community"),
    soon("shopee", "commerce", ["sales", "accounting"], 96, "cart"),
    soon("tiktok_shop", "commerce", ["sales", "accounting"], 88, "cart"),
    soon("lazada", "commerce", ["sales", "accounting"], 70, "cart"),
    soon("kiotviet", "commerce", ["sales", "accounting"], 85, "cart"),
    soon("sapo", "commerce", ["sales", "accounting"], 78, "cart"),
    soon("haravan", "commerce", ["sales", "accounting"], 66, "cart"),
    soon("shopify", "commerce", ["sales", "accounting"], 55, "cart"),
    soon("woocommerce", "commerce", ["sales", "accounting"], 45, "cart"),
    soon("misa_amis", "accounting", ["accounting"], 84, "wallet"),
    soon("misa_meinvoice", "accounting", ["accounting"], 80, "wallet"),
    soon("viettel_sinvoice", "accounting", ["accounting"], 62, "wallet"),
    soon("vnpay", "payments", ["accounting"], 64, "wallet"),
    soon("momo", "payments", ["accounting"], 63, "wallet"),
    soon("ghn", "commerce", ["sales"], 58, "cart"),
    soon("ghtk", "commerce", ["sales"], 57, "cart"),
    soon("google_calendar", "productivity", ["any"], 52, "apps", "/logos/connectors/calendar.svg"),
    soon("notion", "productivity", ["any"], 50, "apps", "/logos/connectors/notion_generic.svg"),
    soon("slack", "productivity", ["any"], 40, "apps", "/logos/connectors/slack_generic.svg"),
    soon("airtable", "data", ["any"], 38, "servers", "/logos/connectors/airtable_generic.svg"),
]

/** The four connectors the workspace can use today, in the order the library shows them; every other connector sits in a later section. */
export const CURRENT_CONNECTORS: ReadonlyArray<string> = ["google_drive", "sepay", "zalo_oa", "telegram"]

/** Finds a connector by id. */
export const entryById = (id: string): CatalogEntry | undefined => CATALOG.find((entry) => entry.id === id)

/** The catalog key of one text of a connector: a provider connector reuses the provider words. */
export const catalogKey = (entry: CatalogEntry, part: "name" | "blurb" | "brings" | "keywords" | "needs"): string => {
    if (entry.provider !== undefined && part === "name") return providerKey(entry.provider, "title")
    if (entry.provider !== undefined && part === "blurb") return providerKey(entry.provider, "blurb")
    return `catalog_${entry.id}_${part}`
}

/** Unicode Latin small d with stroke does not decompose under NFD. */
const STROKED_D = String.fromCodePoint(0x0111)

/** Lower-cases a text and drops accents so a search ignores them. */
const foldText = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replaceAll(STROKED_D, "d")

/** The words of a search (accents ignored). */
export const searchWords = (text: string): ReadonlyArray<string> => foldText(text).split(/\s+/u).filter(Boolean)

/** Whether every search word appears in the connector text (name, blurb and keywords joined). */
export const matchesWords = (haystack: string, words: ReadonlyArray<string>): boolean => {
    const folded = foldText(haystack)
    return words.every((word) => folded.includes(word))
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/** Resolves a supported category from a control value. */
export const asCategory = (id: string): ConnectorCategory | "all" =>
    CATEGORIES.find((category) => category === id) ?? "all"

/** The connector's own availability beside its name: planned or early access; nothing for an official one. */
export const catalogTagOf = (
    entry: CatalogEntry,
    t: Translate,
): { readonly tone: "accent" | "neutral"; readonly label: string } | null => {
    if (entry.status === "soon") return { tone: "neutral", label: t("statusSoon") }
    return entry.status === "early" ? { tone: "accent", label: t("statusEarly") } : null
}

/** What the workspace runs of a connector, at the foot of its tile: the count in use, a check it needs, or not connected yet. */
export const catalogStatusOf = (
    count: number,
    t: Translate,
    needsCheck = false,
): { readonly tone: "success" | "danger" | "muted"; readonly label: string; readonly isDot: boolean } => {
    if (needsCheck) return { tone: "danger", label: t("libNeedsCheck"), isDot: true }
    if (count > 0) return { tone: "success", label: t("libInUse", { count }), isDot: true }
    return { tone: "muted", label: t("libNotConnected"), isDot: false }
}

/** The "Cho: ..." line of a connector: the agents it serves, or every agent. */
export const audienceLineOf = (entry: CatalogEntry, t: Translate): string =>
    t("libFor", {
        names: entry.audience.includes("any")
            ? t("aud_any")
            : entry.audience.map((audience) => t(`aud_${audience}`)).join(", "),
    })

/** Counts active workspace connections for each provider in the catalog. */
export const connectionCountsOf = (items: ReadonlyArray<Connection>): Map<string, number> => {
    const counts = new Map<string, number>()
    for (const connection of items) {
        if (connection.status !== "disconnected")
            counts.set(connection.provider, (counts.get(connection.provider) ?? 0) + 1)
    }
    return counts
}

/** The providers where the workspace has a connection that needs a check (unfinished or broken). */
export const checkProvidersOf = (items: ReadonlyArray<Connection>): ReadonlySet<string> =>
    new Set(
        items
            .filter((connection) => connection.status === "pending" || connection.status === "error")
            .map((connection) => connection.provider),
    )
