import type { ConnectorCategory, Provider } from "@/modules/types"

/** The groups of the library, in the order they head it: a filter and a heading, never a page or a level of the trail. */
export const CONNECTION_GROUPS: readonly ["chat", "money", "google", "data", "sales", "accounting"] = [
    "chat",
    "money",
    "google",
    "data",
    "sales",
    "accounting",
]

/** One group of the library. */
export type ConnectionGroup = (typeof CONNECTION_GROUPS)[number]

/** The connectors that belong to the one Google provider: one account, its services switched on inside it. */
const GOOGLE_IDS: ReadonlySet<string> = new Set(["google", "google_drive", "google_calendar", "gmail"])

/** The group of each library category; Google's connectors go to the Google group whatever their category. */
const GROUP_OF_CATEGORY: Readonly<Record<ConnectorCategory, ConnectionGroup>> = {
    chat: "chat",
    payments: "money",
    commerce: "sales",
    accounting: "accounting",
    data: "data",
    email: "data",
    productivity: "data",
    automation: "data",
}

/** The group a connector of the library heads under. */
export const groupOfConnector = (id: string, category: ConnectorCategory): ConnectionGroup =>
    GOOGLE_IDS.has(id) ? "google" : GROUP_OF_CATEGORY[category]

/** What one connection of a provider is called, for its count ("2 bots") and its "add another" command ("Add bot"). */
export type ProviderUnit = "bot" | "oa" | "account" | "api" | "webhook" | "connection"

/** The unit of each provider that holds many connections; every other one counts plain connections. */
const UNIT_OF_PROVIDER: Readonly<Partial<Record<Provider, ProviderUnit>>> = {
    telegram: "bot",
    zalo_oa: "oa",
    sepay: "account",
    payos: "account",
    casso: "account",
    google: "account",
    google_drive: "account",
    openapi: "api",
    webhook: "webhook",
}

/** The unit a provider counts its connections in. */
export const unitOfProvider = (provider: Provider): ProviderUnit => UNIT_OF_PROVIDER[provider] ?? "connection"

/** The address segment of each provider's own page under Connections; Google's two connectors share the one Google page. */
const PROVIDER_SEGMENT: Readonly<Partial<Record<Provider, string>>> = {
    telegram: "telegram",
    zalo_oa: "zalo",
    sepay: "sepay",
    google: "google",
    google_drive: "google",
}

/** The address segment of a provider's own page: `/connections/<segment>`. */
export const providerSegmentOf = (provider: Provider): string => PROVIDER_SEGMENT[provider] ?? provider

/**
 * The provider ids a page address names (Google's account page names both of Google's connectors); the caller keeps the ones that
 * are real providers.
 */
export const providersOfSegment = (segment: string): ReadonlyArray<string> => {
    if (segment === "google") return ["google", "google_drive"]
    const named = Object.entries(PROVIDER_SEGMENT).find(([, value]) => value === segment)
    return [named === undefined ? segment : named[0]]
}
