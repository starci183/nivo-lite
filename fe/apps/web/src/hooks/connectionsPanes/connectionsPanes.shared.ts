import { bankLogo } from "@/hooks/banks"
import { PROVIDERS, PROVIDER_LOGO, providerKey } from "@/hooks/connection-providers"
import { connectionFactsOf, showsBankLogo } from "@/hooks/connection-rows"
import { connectionPageHref, statusKey, statusTone } from "@/hooks/connections"
import type {
    Connection,
    ConnectionAgentRow,
    ConnectionFilterChoice,
    ConnectionListRow,
    ConnectionNextStep,
    ConnectionPaneTone,
} from "@/modules/types"

/** A catalog reader of the `connections` namespace: a key and the values of its placeholders. */
type Translate = (key: string, values?: Record<string, string | number>) => string

/** The filter ids of the list pane, in the order the chips draw. */
export const FILTER_IDS = ["all", "attention", "money", "chat", "data", "email", "automation"] as const

/** The filter a provider's kind belongs to (besides "all" and "attention"). */
const GROUP_OF_KIND: Readonly<Record<string, string>> = {
    money: "money",
    telegram: "chat",
    zalo: "chat",
    meta: "chat",
    google: "data",
    drive: "data",
    data: "data",
    email: "email",
    webhook: "automation",
}

/** The filters one connection passes: its kind's group, and "attention" while it needs the owner. */
export const groupsOf = (connection: Connection): ReadonlyArray<string> => {
    const group = GROUP_OF_KIND[PROVIDERS[connection.provider].kind]
    return [
        ...(group === undefined ? [] : [group]),
        ...(connection.status === "pending" || connection.status === "error" ? ["attention"] : []),
    ]
}

/** The status chip of a connection: a test-mode money feed says so, the others say how they are doing. */
export const chipOf = (
    connection: Connection,
    t: Translate,
): { readonly label: string; readonly tone: ConnectionPaneTone; readonly isDot: boolean } => {
    if (connection.environment === "test" && connection.status === "connected") {
        return { label: t("envBadgeTest"), tone: "warning", isDot: false }
    }
    return { label: t(statusKey(connection.status)), tone: statusTone(connection.status), isDot: true }
}

/** The mark of a connection: a bank feed wears the bank's wordmark, the others the provider's own mark. */
export const logoOf = (connection: Connection): ConnectionListRow["logo"] => {
    const bank = showsBankLogo(connection.provider) ? bankLogo(connection.meta.bank_code ?? "") : null
    const src = bank ?? PROVIDER_LOGO[connection.provider]
    return { ...(src === undefined ? {} : { src }), isWordmark: bank !== null }
}

/** One row of the list pane. */
export const listRowOf = (
    connection: Connection,
    t: Translate,
    bankName: (code: string) => string,
): ConnectionListRow => ({
    id: connection.id,
    name: connection.name,
    description: [t(providerKey(connection.provider, "title")), connectionFactsOf(connection, t, bankName)]
        .filter((part) => part !== "")
        .join(" · "),
    logo: logoOf(connection),
    status: chipOf(connection, t),
    href: connectionPageHref(connection),
    groups: groupsOf(connection),
})

/** The filter row: "all" always, the other choices when some row passes them, each with its count. */
export const filtersOf = (
    rows: ReadonlyArray<ConnectionListRow>,
    label: (id: string) => string,
): ReadonlyArray<ConnectionFilterChoice> =>
    FILTER_IDS.map((id) => ({
        value: id,
        label: label(id),
        count: id === "all" ? rows.length : rows.filter((row) => row.groups.includes(id)).length,
    })).filter((choice) => choice.value === "all" || choice.count > 0)

/** Text without accents and case, for the search. */
const plain = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()

/** The rows a search text and a filter leave, accents and case ignored. */
export const visibleRowsOf = (
    rows: ReadonlyArray<ConnectionListRow>,
    filter: string,
    text: string,
): ReadonlyArray<ConnectionListRow> => {
    const words = plain(text).split(/\s+/).filter(Boolean)
    return rows.filter(
        (row) =>
            (filter === "all" || row.groups.includes(filter)) &&
            words.every((word) => plain(`${row.name} ${row.description}`).includes(word)),
    )
}

/** The connection that needs the owner first, in the words of the overview card; null when none does. */
export const nextStepOf = (
    connection: Connection,
    agentNames: ReadonlyArray<string>,
    canManage: boolean,
    t: Translate,
    continueLabel: string,
): ConnectionNextStep => {
    const href = connectionPageHref(connection)
    const body = [
        connection.status === "pending" ? t("attentionPending") : t("attentionError"),
        agentNames.length > 0 ? t("attentionImpact", { names: agentNames.join(", ") }) : "",
    ]
        .filter(Boolean)
        .join(" ")
    return {
        id: connection.id,
        name: connection.name,
        title: t(connection.status === "error" ? "nextTitleError" : "nextTitlePending", { name: connection.name }),
        logo: logoOf(connection),
        status: chipOf(connection, t),
        body,
        action: canManage && href !== null ? { label: continueLabel, href } : null,
    }
}

/** One row per agent that works through a connection: its name and the connections. */
export const agentRowsOf = (
    connections: ReadonlyArray<Connection>,
    agentNames: Readonly<Record<string, string>>,
): ReadonlyArray<ConnectionAgentRow> => {
    const ids = [...new Set(connections.flatMap((connection) => connection.grants.map((grant) => grant.agentId)))]
    return ids.map((id) => ({
        id,
        name: agentNames[id] ?? id,
        description: connections
            .filter((connection) => connection.grants.some((grant) => grant.agentId === id))
            .map((connection) => connection.name)
            .join(" · "),
    }))
}
