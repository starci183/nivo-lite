import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import {
    CONNECTION_GROUPS,
    groupOfConnector,
    unitOfProvider,
    type ConnectionGroup,
    type ProviderUnit,
} from "@/modules/connection-groups"
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
    real("sepay", "payments", ["sales"], 100, "wallet"),
    real("payos", "payments", ["sales"], 70, "wallet"),
    real("casso", "payments", ["sales"], 60, "wallet"),
    real("telegram", "chat", ["chatbot", "sales"], 95, "community"),
    real("zalo_oa", "chat", ["chatbot", "sales"], 98, "community"),
    real("meta", "chat", ["chatbot", "sales"], 97, "community"),
    real("telegram_user", "chat", ["any"], 55, "community"),
    real("database", "data", ["any"], 65, "servers"),
    real("openapi", "data", ["any"], 62, "code"),
    real("csv_import", "data", ["any"], 90, "apps"),
    real("imap", "email", ["any"], 75, "email"),
    real("smtp", "email", ["sales"], 58, "email"),
    real("google", "productivity", ["sales"], 80, "apps"),
    real("google_drive", "productivity", ["any"], 61, "apps"),
    real("webhook", "automation", ["any"], 50, "trigger"),
    soon("tiktok_chat", "chat", ["chatbot"], 60, "community"),
    soon("shopee", "commerce", ["sales"], 96, "cart"),
    soon("tiktok_shop", "commerce", ["sales"], 88, "cart"),
    soon("lazada", "commerce", ["sales"], 70, "cart"),
    soon("kiotviet", "commerce", ["sales"], 85, "cart"),
    soon("sapo", "commerce", ["sales"], 78, "cart"),
    soon("haravan", "commerce", ["sales"], 66, "cart"),
    soon("shopify", "commerce", ["sales"], 55, "cart"),
    soon("woocommerce", "commerce", ["sales"], 45, "cart"),
    soon("misa_amis", "accounting", ["sales"], 84, "wallet"),
    soon("misa_meinvoice", "accounting", ["sales"], 80, "wallet"),
    soon("viettel_sinvoice", "accounting", ["sales"], 62, "wallet"),
    soon("vnpay", "payments", ["sales"], 64, "wallet"),
    soon("momo", "payments", ["sales"], 63, "wallet"),
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
        .replaceAll(/[\u0300-\u036f]/g, "")
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

/** The groups of the library, in the order they head it, for the sub tabs of the Connections page. */
export { CONNECTION_GROUPS }

/** The group a chip id names; "all" for any other id. */
export const asGroup = (id: string): ConnectionGroup | "all" => CONNECTION_GROUPS.find((group) => group === id) ?? "all"

/** The group a connector heads under in the library. */
export const groupOfEntry = (entry: CatalogEntry): ConnectionGroup => groupOfConnector(entry.id, entry.category)

/** The unit a connector counts its connections in ("bot", "account"…); a planned connector counts plain connections. */
export const unitOfEntry = (entry: CatalogEntry): ProviderUnit =>
    entry.provider === undefined ? "connection" : unitOfProvider(entry.provider)

/** The connectors the library folds into another tile: Google Drive is a service of the one Google tile. */
export const FOLDED_CONNECTORS: ReadonlySet<string> = new Set(["google_drive"])

/** The providers a tile counts: the Google tile counts its Drive grant too. */
export const providersOfEntry = (entry: CatalogEntry): ReadonlyArray<string> => {
    if (entry.provider === undefined) return []
    return entry.provider === "google" ? ["google", "google_drive"] : [entry.provider]
}

/** The connector's own availability beside its name: planned or early access; nothing for an official one. */
export const catalogTagOf = (
    entry: CatalogEntry,
    t: Translate,
): { readonly tone: "accent" | "neutral"; readonly label: string } | null => {
    if (entry.status === "soon") return { tone: "neutral", label: t("statusSoon") }
    return entry.status === "early" ? { tone: "accent", label: t("statusEarly") } : null
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
