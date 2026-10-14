import type { Access, Purpose } from "@/modules/types"

/** Lowest to highest. A new grant starts at `ask`; `auto` is never a default. */
export const ACCESS_LEVELS: ReadonlyArray<Access> = ["read", "ask", "auto"]

/** module:provider -> purpose. A pair that is not listed cannot be granted (the picker shows it disabled with the reason). */
const PURPOSE: Readonly<Record<string, Purpose>> = {
    "chatbot:telegram": "inbound_chat",
    "chatbot:zalo_oa": "inbound_chat",
    // Booking and Loyalty can also listen on a chat connection (the chatbot stays the front door and hands over by intent).
    "booking:telegram": "inbound_chat",
    "booking:zalo_oa": "inbound_chat",
    "loyalty:telegram": "inbound_chat",
    "loyalty:zalo_oa": "inbound_chat",
    // Facebook Pages and Instagram: DMs, comments and mentions reach the same front doors; lead ads go to the lead sources.
    "chatbot:meta": "inbound_chat",
    "booking:meta": "inbound_chat",
    "loyalty:meta": "inbound_chat",
    "lead_gen:meta": "lead_source",
    "sales:meta": "lead_source",
    // Shifts and Sales speak to staff or customers only through the connections bound to them.
    "shifts:telegram": "outbound_chat",
    "shifts:zalo_oa": "outbound_chat",
    "sales:telegram": "outbound_chat",
    "sales:zalo_oa": "outbound_chat",
    "accounting:sepay": "bank_feed",
    "accounting:payos": "bank_feed",
    "accounting:casso": "bank_feed",
}

/** Data connectors every agent may read from (a database, an API, an import, a mailbox, a personal Telegram). */
const DATA_PROVIDERS: ReadonlySet<string> = new Set(["database", "openapi", "csv_import", "imap", "telegram_user"])

/** True for the data connectors every agent may read from (a database, an API, an import, a mailbox, a personal Telegram), whatever its module. */
export const isDataConnector = (provider: string): boolean => DATA_PROVIDERS.has(provider)

/** The purpose a grant of `provider` to an agent of `module` has, or null when that agent cannot use that provider. */
export const purposeFor = (module: string, provider: string): Purpose | null => {
    const direct = PURPOSE[`${module}:${provider}`]
    if (direct !== undefined) return direct
    if (DATA_PROVIDERS.has(provider)) return provider === "openapi" ? "tool" : "data_source"
    return null
}
