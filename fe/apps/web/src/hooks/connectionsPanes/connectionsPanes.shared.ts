import { bankLogo } from "@/hooks/banks"
import { PROVIDERS, PROVIDER_LOGO, providerKey } from "@/hooks/connection-providers"
import { connectionFactsOf, showsBankLogo } from "@/hooks/connection-rows"
import { connectionPageHref } from "@/hooks/connections"
import { lifecycleChipOf, lifecycleOf, PHASE_COUNT, phaseOfLife } from "@/modules/connection-lifecycle"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type {
    Connection,
    ConnectionFilterChoice,
    ConnectionLifecycleChip,
    ConnectionListRow,
    ConnectionNextStep,
} from "@/modules/types"

/** A catalog reader of the `connections` namespace: a key and the values of its placeholders. */
type Translate = (key: string, values?: Record<string, string | number>) => string

/** The filter ids of the list pane, in the order the chips draw. */
export const FILTER_IDS = ["all", "attention", "chat", "money", "google", "data", "automation"] as const

/** The group a provider's kind belongs to (besides "all" and "attention"): the library's groups, plus automation. */
const GROUP_OF_KIND: Readonly<Record<string, string>> = {
    money: "money",
    telegram: "chat",
    zalo: "chat",
    meta: "chat",
    google: "google",
    drive: "google",
    data: "data",
    email: "data",
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

/** The status chip of a connection, in the one vocabulary of the Connections screens. */
export const chipOf = (connection: Connection, t: Translate): ConnectionLifecycleChip =>
    lifecycleChipOf(lifecycleOf(connection), t)

/** The page a row opens: the provider's own page, or the generic page of a connection without one. */
export const rowHrefOf = (connection: Connection, workspaceId: string): string =>
    connectionPageHref(workspaceId, connection) ??
    `${workspaceHref(workspaceId, CONSOLE_ROUTES.connections)}/open/${connection.id}`

/** The mark of a connection: a bank feed wears the bank's wordmark, the others the provider's own mark. */
export const logoOf = (connection: Connection): ConnectionListRow["logo"] => {
    const bank = showsBankLogo(connection.provider) ? bankLogo(connection.meta.bank_code ?? "") : null
    const src = bank ?? PROVIDER_LOGO[connection.provider]
    return { ...(src === undefined ? {} : { src }), isWordmark: bank !== null }
}

/** The setup step a row names while the connection is set up or waits for its first event; empty otherwise. */
const stepLineOf = (connection: Connection, t: Translate): string => {
    const life = lifecycleOf(connection)
    return life.id === "setup" || life.id === "waiting"
        ? t("rowStep", { n: phaseOfLife(life), total: PHASE_COUNT })
        : ""
}

/** A Google account is named by its email, its line says which service ("Google · Sheets"); the others by name and provider facts. */
const identityOf = (connection: Connection, t: Translate, bankName: (code: string) => string) => {
    const email = connection.meta.email ?? ""
    const isGoogle = (connection.provider === "google" || connection.provider === "google_drive") && email !== ""
    const parts = isGoogle
        ? [t("group_google"), t(connection.provider === "google" ? "serviceSheets" : "serviceDrive")]
        : [t(providerKey(connection.provider, "title")), connectionFactsOf(connection, t, bankName)]
    const description = [...parts, stepLineOf(connection, t)].filter((part) => part !== "").join(" · ")
    return { name: isGoogle ? email : connection.name, description }
}

/** One row of the list. */
export const listRowOf = (
    connection: Connection,
    t: Translate,
    bankName: (code: string) => string,
    workspaceId: string,
    agentNames: Readonly<Record<string, string>>,
): ConnectionListRow => ({
    id: connection.id,
    ...identityOf(connection, t, bankName),
    logo: logoOf(connection),
    status: chipOf(connection, t),
    href: rowHrefOf(connection, workspaceId),
    groups: groupsOf(connection),
    lastEventAt: connection.lastEventAt,
    isFailed: connection.status === "error",
    agents: connection.agentIds
        .map((id) => agentNames[id])
        .filter((name): name is string => name !== undefined)
        .join(", "),
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
        .replaceAll(/\p{Diacritic}/gu, "")
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

/** The providers whose failure is fixed by granting the access again (an OAuth grant expired or was revoked). */
const GRANT_AGAIN: ReadonlySet<string> = new Set(["zalo_oa", "google_drive", "google", "meta"])

/** The one action a connection that needs the owner gets: fix a failure (the region's primary), or continue a setup. */
const actionLabelOf = (connection: Connection, t: Translate): string => {
    if (connection.status !== "error") return t("actionContinue")
    return GRANT_AGAIN.has(connection.provider) ? t("actionGrantAgain") : t("actionFix")
}

/** What is wrong or still missing: the failure as the provider said it, or the setup step and what it waits for. */
const attentionBodyOf = (connection: Connection, t: Translate): string => {
    const life = lifecycleOf(connection)
    if (life.id === "attention") return connection.lastError ?? t("attentionError")
    if (life.id === "waiting") {
        return t("attentionWaitingBody", {
            n: phaseOfLife(life),
            total: PHASE_COUNT,
            hint: t("attentionWaitingHint", { provider: t(providerKey(connection.provider, "title")) }),
        })
    }
    return t("attentionSetupBody", { n: phaseOfLife(life), total: PHASE_COUNT })
}

/** The title of a connection that needs the owner: it stopped, it waits for its first event, or its setup is unfinished. */
const attentionTitleOf = (connection: Connection, t: Translate): string => {
    const life = lifecycleOf(connection)
    if (life.id === "attention") return t("nextTitleError", { name: connection.name })
    return t(life.id === "waiting" ? "nextTitleWaiting" : "nextTitlePending", { name: connection.name })
}

/** One connection that needs the owner, in the words of the "Needs you" card, with its one action. */
export const nextStepOf = (
    connection: Connection,
    agentNames: ReadonlyArray<string>,
    canManage: boolean,
    t: Translate,
    workspaceId: string,
): ConnectionNextStep => {
    const impact = connection.status === "error" && agentNames.length > 0
    const body = [attentionBodyOf(connection, t), impact ? t("attentionImpact", { names: agentNames.join(", ") }) : ""]
        .filter(Boolean)
        .join(" ")
    return {
        id: connection.id,
        name: connection.name,
        title: attentionTitleOf(connection, t),
        logo: logoOf(connection),
        status: chipOf(connection, t),
        body,
        action: canManage
            ? {
                  label: actionLabelOf(connection, t),
                  href: rowHrefOf(connection, workspaceId),
              }
            : null,
    }
}
