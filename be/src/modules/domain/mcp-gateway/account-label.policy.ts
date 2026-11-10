import { bankDisplayNameOf } from "@modules/domain/channel-connections"

/** What a connection stores about the account it reaches: the public facts the provider reported when it was connected. */
export type AccountFacts = Readonly<Record<string, string>>

/** A stored fact, trimmed, or null when the connection does not hold it. */
const factOf = (facts: AccountFacts, key: string): string | null => {
    const value = (facts[key] ?? "").trim()
    return value === "" ? null : value
}

/**
 * The name of a connected account as people read it, from what its connection already stores; nothing is fetched. A bank feed: the
 * bank and the masked number ("MB Bank •••• 9999"). A Google account: the title of the sheet it keeps, with the email. A Telegram
 * bot: its @handle. A Zalo OA: the connection's own name with the OA id, since the OA's display name is not stored at connect time.
 * A connection that holds none of these keeps its own name.
 */
export const accountLabelOf = (provider: string, name: string, facts: AccountFacts): string => {
    if (provider === "sepay" || provider === "payos") {
        const bank = factOf(facts, "bank_code")
        const masked = factOf(facts, "account_masked")
        const parts = [bank === null ? null : bankDisplayNameOf(bank), masked].filter((part) => part !== null)
        return parts.length === 0 ? name : parts.join(" ")
    }
    if (provider === "google") {
        const sheet = factOf(facts, "ledgerSheetTitle")
        const email = factOf(facts, "email")
        if (sheet !== null) return email === null ? sheet : `${sheet} (${email})`
        return email ?? name
    }
    if (provider === "telegram") {
        const handle = factOf(facts, "bot_username")
        return handle === null ? name : `@${handle.replace(/^@/u, "")}`
    }
    if (provider === "zalo_oa") {
        const shown = factOf(facts, "oa_name")
        const oaId = factOf(facts, "oa_id")
        if (shown !== null) return shown
        return oaId === null ? name : `${name} · OA ${oaId}`
    }
    return name
}
