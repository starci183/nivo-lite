import type { ProviderInfo, ProviderInfoFigure } from "@modules/domain/workbench-door"

/** What a connection's record says that an account's info is drawn from. */
export interface AccountRecord {
    /** The connection. */
    readonly id: string
    /** Where the connection stands. */
    readonly status: string
    /** The code of its last failure, or null. */
    readonly lastError: string | null
    /** When its last event arrived, ISO 8601, or null. */
    readonly lastEventAt: string | null
    /** Its public facts. */
    readonly meta: Readonly<Record<string, string>>
}

/** The most figures an account card draws. */
const FIGURES_MAX = 6

/** A public fact of the record, trimmed, or null when it holds none. */
export const factOf = (record: AccountRecord, key: string): string | null => {
    const value = (record.meta[key] ?? "").trim()
    return value === "" ? null : value
}

/** The state of an account from its record: disconnected is `off`; a failure that still stands, or any other status, needs the owner. */
export const accountStateOf = (record: AccountRecord): ProviderInfo["state"] => {
    if (record.status === "disconnected") return "off"
    return record.status === "connected" && (record.lastError ?? "").trim() === "" ? "ok" : "attention"
}

/** The info of one account: its state and the provider's figures, at most six. */
export const accountInfoOf = (record: AccountRecord, figures: ReadonlyArray<ProviderInfoFigure>): ProviderInfo => ({
    connectionId: record.id,
    state: accountStateOf(record),
    figures: figures.slice(0, FIGURES_MAX),
    asOf: record.lastEventAt,
})

/**
 * The figures of a bank feed: the account it reports, how many raw transactions of the account NIVO holds, and when one last arrived.
 * A count the store could not give is null (drawn as a dash).
 */
export const bankFiguresOf = (record: AccountRecord, received: number | null = null): ReadonlyArray<ProviderInfoFigure> => [
    { key: "account", label: { vi: "T\u00e0i kho\u1ea3n", en: "Account" }, value: factOf(record, "account_masked"), kind: "text" },
    {
        key: "transactions_received",
        label: { vi: "Giao d\u1ecbch \u0111\u00e3 nh\u1eadn", en: "Transactions received" },
        value: received,
        kind: "count",
    },
    {
        key: "last_received",
        label: { vi: "Giao d\u1ecbch g\u1ea7n nh\u1ea5t", en: "Last transaction" },
        value: record.lastEventAt,
        kind: "time",
    },
]

/** The figures of a mailbox: what its last sync said and when it last received. */
export const mailboxFiguresOf = (record: AccountRecord): ReadonlyArray<ProviderInfoFigure> => [
    { key: "last_sync", label: { vi: "L\u1ea7n \u0111\u1ed3ng b\u1ed9 g\u1ea7n nh\u1ea5t", en: "Last sync" }, value: factOf(record, "summary"), kind: "text" },
    { key: "last_received", label: { vi: "Th\u01b0 g\u1ea7n nh\u1ea5t", en: "Last mail" }, value: record.lastEventAt, kind: "time" },
]
