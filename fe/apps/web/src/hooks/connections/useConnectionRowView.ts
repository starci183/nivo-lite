"use client"

import { bankLogo, useBankName } from "@/hooks/banks"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import {
    alertsOf,
    connectionFactsOf,
    dialogOf,
    menuOf,
    notesOf,
    primaryOf,
    showsBankLogo,
    usesAgents,
} from "@/hooks/connection-rows"
import type { AgentOption, Connection, RowPrimary, RowView } from "@/modules/types"
import { useTranslations } from "next-intl"
import { connectionPageHref, rowState, statusKey, statusTone } from "./connections.shared"
import { useAgentAccess } from "./useAgentAccess"
import type { AgentAccess } from "./useAgentAccess"
import { useConnectionOverlays } from "./useConnectionOverlays"
import { useConnectionRowActions } from "./useConnectionRowActions"
import { useSetConnectionGrant } from "./useSetConnectionGrant"
import { useSmtpRowPanel } from "./useSmtpRowPanel"
import type { SmtpRowPanel } from "./useSmtpRowPanel"

/** What a connection row is given by the page that read it. */
export interface ConnectionRowViewInput {
    readonly connection: Connection
    readonly agentNames: ReadonlyArray<string>
    readonly localOnly: boolean
    readonly ownerEmail: string
    readonly agents: ReadonlyArray<AgentOption>
    readonly canManage: boolean
}

/** The commands a row's menu, buttons and dialogs give. */
export interface ConnectionRowHandlers {
    readonly primary: (id: RowPrimary["id"]) => void
    readonly menu: (id: string) => void
    readonly pick: (agentId: string, value: string) => void
    readonly dialog: (kind: "disconnect" | "remove", action: "confirm" | "cancel") => void
    readonly smtpToggle: (panel: "test" | "password") => void
    readonly smtpTo: (value: string) => void
    readonly smtpPassword: (value: string) => void
    readonly smtpTest: () => void
    readonly smtpSavePassword: () => void
    readonly smtpMakeDefault: () => void
    readonly smtpClose: () => void
}

/**
 * Everything one connection row shows, as data, and the commands behind it. The row's wording, its one visible action, its menu and
 * its confirmations are decided here from the connection's state; the drawing half only paints them.
 */
export const useConnectionRowView = (
    input: ConnectionRowViewInput,
): { readonly view: RowView; readonly on: ConnectionRowHandlers } => {
    const { connection: c } = input
    const t = useTranslations("connections")
    const bankName = useBankName()
    const overlays = useConnectionOverlays()
    const actions = useConnectionRowActions(c)
    const setGrant = useSetConnectionGrant()
    const smtp: SmtpRowPanel = useSmtpRowPanel(c, input.ownerEmail)
    const access: AgentAccess = useAgentAccess(
        c,
        input.agents,
        input.canManage,
        (agentId, level) => setGrant(c.id, agentId, level),
        (text) => actions.setNote({ tone: "negative", text }),
    )

    const live = c.status !== "disconnected"
    const usedBy = input.agentNames.length > 0 ? t("usedBy", { names: input.agentNames.join(", ") }) : ""
    const bankSrc = showsBankLogo(c.provider) ? bankLogo(c.meta.bank_code ?? "") : null
    const providerSrc = PROVIDER_LOGO[c.provider]
    const src = bankSrc ?? providerSrc

    const view: RowView = {
        id: c.id,
        title: c.name,
        logo: { ...(src === undefined ? {} : { src }), isWordmark: bankSrc !== null },
        statusLabel: t(statusKey(c.status)),
        statusTone: statusTone(c.status),
        envLabel: c.environment === "test" ? t("envBadgeTest") : null,
        facts: connectionFactsOf(c, t, bankName),
        telegramHandle: c.provider === "telegram" ? (c.meta.bot_username ?? null) : null,
        usedBy,
        state: rowState(c.status),
        primary: primaryOf(c, input.canManage, actions.busy, t),
        access: usesAgents(c.provider) && live ? access.view : null,
        page: live ? pageOf(c, t("openPage")) : null,
        menuLabel: t("more", { name: c.name }),
        menuIsDisabled: actions.busy === "keys",
        menu: menuOf(c, input.canManage, t),
        alerts: alertsOf(c, input.agentNames, t),
        notes: notesOf(c, input.localOnly, t),
        smtp: c.provider === "smtp" && live ? smtp.view : null,
        keys:
            actions.keys === null
                ? null
                : {
                      urlLabel: t("webhookUrl"),
                      url: actions.keys.webhookUrl,
                      keyLabel: t("apiKey"),
                      key: actions.keys.apiKey,
                  },
        copy: { ...copyLabelsOf(t) },
        note: actions.note,
        disconnect: dialogOf("disconnect", c, actions.confirm, actions.busy, t),
        remove: dialogOf("remove", c, actions.confirm, actions.busy, t),
    }

    const on: ConnectionRowHandlers = actionsOf(overlays, c, actions, access, smtp)
    return { view, on }
}

/** The link to the connection's own page, when its provider has one. */
const pageOf = (c: Connection, label: string): RowView["page"] => {
    const href = connectionPageHref(c)
    return href === null ? null : { href, label }
}

/** Resolves the copy labels for the current locale. */
const copyLabelsOf = (t: ReturnType<typeof useTranslations<"connections">>) => ({
    copy: t("copy"),
    copied: t("copied"),
    reveal: t("reveal"),
    hide: t("hide"),
})

const actionsOf = (
    overlays: ReturnType<typeof useConnectionOverlays>,
    c: Connection,
    actions: ReturnType<typeof useConnectionRowActions>,
    access: ReturnType<typeof useAgentAccess>,
    smtp: ReturnType<typeof useSmtpRowPanel>,
): ConnectionRowHandlers => {
    return {
        primary: (id) => {
            if (id === "continue") overlays.openWizard(c.provider, c.id)
            else if (id === "reconnectGoogle") actions.reconnectGoogle()
            else if (id === "check") actions.check()
            else if (id === "sync") actions.sync()
            else actions.sendTest()
        },
        menu: (id) => {
            if (id === "edit") overlays.openWizard(c.provider, c.id)
            else if (id === "keys") actions.showKeys()
            else actions.setConfirm(id === "remove" ? "remove" : "disconnect")
        },
        pick: access.pick,
        dialog: (kind, action) => {
            if (action === "cancel") actions.setConfirm(null)
            else if (kind === "disconnect") actions.disconnect()
            else actions.remove()
        },
        smtpToggle: smtp.toggle,
        smtpTo: smtp.setTo,
        smtpPassword: smtp.setPassword,
        smtpTest: smtp.test,
        smtpSavePassword: smtp.savePassword,
        smtpMakeDefault: smtp.makeDefault,
        smtpClose: smtp.close,
    }
}
