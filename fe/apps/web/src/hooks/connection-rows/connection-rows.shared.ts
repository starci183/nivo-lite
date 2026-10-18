import { isDataConnector } from "@/hooks/connection-access"
import { PROVIDERS } from "@/hooks/connection-providers"
import type { Connection, Provider, RowAlert, RowDialog, RowMenuSection, RowPrimary } from "@/modules/types"

/** A catalog reader as the row builders receive it: a key and the values of its placeholders. */
export type RowTranslate = (key: string, values?: Record<string, string | number>) => string

/** The command a row is running (only its own control shows pending). */
export type RowBusy = "check" | "test" | "google" | "keys" | "disconnect" | "remove" | "sync" | null

/** The destructive command waiting for the owner's confirmation. */
export type RowConfirm = "disconnect" | "remove" | null

const MONEY: ReadonlySet<string> = new Set(["sepay", "payos", "casso"])
const BANK_LOGO: ReadonlySet<string> = new Set(["sepay", "casso"])
const NO_AGENTS: ReadonlySet<string> = new Set(["webhook", "google", "smtp"])
const RESUMABLE_KINDS: ReadonlySet<string> = new Set(["money", "zalo", "meta", "data"])

/** Bank feeds (SePay, payOS, Casso): money arriving for the Accounting agent. */
export const isBankFeed = (provider: Provider): boolean => MONEY.has(provider)

/** Providers whose row shows the bank wordmark. */
export const showsBankLogo = (provider: Provider): boolean => BANK_LOGO.has(provider)

/** Providers an agent works through (the others are the workspace's own tools: outgoing webhooks, Google, SMTP). */
export const usesAgents = (provider: Provider): boolean => !NO_AGENTS.has(provider)

/** Providers whose wizard can be reopened to continue an unfinished one or edit it. */
export const canReopen = (provider: Provider): boolean => RESUMABLE_KINDS.has(PROVIDERS[provider].kind)

const join = (parts: ReadonlyArray<string | undefined>): string => parts.filter(Boolean).join(" · ")

/** The facts line of a connection: what identifies it on the provider's side (account, mailbox, bank, Page, OA). */
export const connectionFactsOf = (c: Connection, t: RowTranslate, bankName: (code: string) => string): string => {
    if (isDataConnector(c.provider)) return join([c.meta.account, c.meta.email, c.meta.host, c.meta.summary])
    switch (c.provider) {
        case "smtp":
            return join([c.meta.from_email, c.meta.host])
        case "google":
            return c.meta.email ?? ""
        case "webhook":
            return t("webhookFacts", {
                host: c.meta.host ?? "",
                count: (c.meta.events ?? "").split(",").filter(Boolean).length,
            })
        case "sepay":
        case "casso":
            return join([
                c.meta.bank_code === undefined ? "" : bankName(c.meta.bank_code),
                c.meta.account_masked,
                c.meta.account_holder,
            ])
        case "meta":
            return join([c.meta.page_name, c.meta.ig_username === undefined ? "" : `@${c.meta.ig_username}`])
        case "zalo_oa":
            return join([
                c.meta.oa_id === undefined ? "" : t("factsOa", { id: c.meta.oa_id }),
                c.meta.app_id === undefined ? "" : t("factsApp", { id: c.meta.app_id }),
            ])
        default:
            return ""
    }
}

/** The one visible action of a row: what the connection's state asks for next, or null when nothing does. */
export const primaryOf = (c: Connection, canManage: boolean, busy: RowBusy, t: RowTranslate): RowPrimary | null => {
    const settled = c.status !== "disconnected" && c.status !== "pending"
    const broken = c.status === "error"
    const reconnects = c.provider === "zalo_oa" || c.provider === "meta"
    const reopening = reopenPrimaryOf(c, canManage, t)
    if (reopening !== null) return reopening
    if (canManage && c.provider === "google" && broken) {
        return {
            id: "reconnectGoogle",
            label: t("googleReconnect"),
            variant: "secondary",
            isPending: busy === "google",
        }
    }
    if (settled && (c.provider === "telegram" || reconnects)) {
        return { id: "check", label: t("check"), variant: "outline", isPending: busy === "check" }
    }
    if (canManage && settled && isDataConnector(c.provider) && c.provider !== "csv_import") {
        return { id: "sync", label: t("syncNow"), variant: "outline", isPending: busy === "sync" }
    }
    if (settled && c.provider === "webhook") {
        return { id: "sendTest", label: t("webhookSendTest"), variant: "outline", isPending: busy === "test" }
    }
    return null
}

/** The menu of a row: the commands that edit it first, the destructive one last; empty for a viewer who cannot manage. */
export const menuOf = (c: Connection, canManage: boolean, t: RowTranslate): ReadonlyArray<RowMenuSection> => {
    if (!canManage) return []
    const live = c.status !== "disconnected"
    const settled = live && c.status !== "pending"
    const editable =
        (isDataConnector(c.provider) && live) ||
        (isBankFeed(c.provider) && c.status !== "pending") ||
        (c.provider === "meta" && settled)
    const commands = [
        ...(editable && canReopen(c.provider) ? [{ id: "edit", label: t("edit") }] : []),
        ...(c.provider === "sepay" && settled ? [{ id: "keys", label: t("showKey") }] : []),
    ]
    const danger = live
        ? { id: "disconnect", label: t("disconnect"), tone: "negative" as const }
        : { id: "remove", label: t("remove"), tone: "negative" as const }
    return [...(commands.length > 0 ? [{ id: "commands", items: commands }] : []), { id: "danger", items: [danger] }]
}

/** The confirmation of one destructive command. */
export const dialogOf = (
    kind: "disconnect" | "remove",
    c: Connection,
    confirm: RowConfirm,
    busy: RowBusy,
    t: RowTranslate,
): RowDialog => ({
    isOpen: confirm === kind,
    title: t(`${kind}Title`, { name: c.name }),
    description: t(`${kind}Body`),
    confirmLabel: t(kind),
    cancelLabel: t("cancel"),
    isPending: busy === kind,
})

/** The alerts inside a row: a connection nobody uses yet, and the last error of a live one. */
export const alertsOf = (
    c: Connection,
    agentNames: ReadonlyArray<string>,
    t: RowTranslate,
): ReadonlyArray<RowAlert> => {
    const live = c.status !== "disconnected"
    const needsAgent = live && c.status !== "pending" && usesAgents(c.provider) && agentNames.length === 0
    const hint = isBankFeed(c.provider) ? t("noAgentHintBank") : t("noAgentHint")
    return [
        ...(needsAgent ? [{ id: "agent", tone: "cautionary" as const, title: t("noAgent"), description: hint }] : []),
        ...(c.lastError !== null && live
            ? [{ id: "error", tone: "negative" as const, title: t("statusError"), description: c.lastError }]
            : []),
    ]
}

/** The muted notes of a row: Telegram on a local site, Zalo's reply window. */
export const notesOf = (c: Connection, localOnly: boolean, t: RowTranslate): ReadonlyArray<string> => {
    const live = c.status !== "disconnected"
    return [
        ...(c.provider === "telegram" && live && localOnly ? [t("localNote")] : []),
        ...(c.provider === "zalo_oa" && live ? [t("zaloSoon")] : []),
    ]
}

/** Offers continuation or reauthorization when an editable provider can resume its wizard. */
const reopenPrimaryOf = (c: Connection, canManage: boolean, t: RowTranslate): RowPrimary | null => {
    const broken = c.status === "error"
    const reconnects = c.provider === "zalo_oa" || c.provider === "meta"
    const reopens = c.status === "pending" || (broken && reconnects)
    if (!canManage || !canReopen(c.provider) || !reopens) return null
    const reconnectLabel = c.provider === "zalo_oa" ? "zaloReauthorize" : "metaReconnect"
    return { id: "continue", label: broken ? t(reconnectLabel) : t("continue"), variant: "secondary", isPending: false }
}
