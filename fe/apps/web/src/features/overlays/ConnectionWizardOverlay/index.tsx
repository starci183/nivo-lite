"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { purposeFor } from "@/hooks/connection-access"
import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { useQueryAuthUserSwr } from "@/hooks/auth"
import {
    moneyProviderOf,
    useConnectionOverlays,
    useConnectionsData,
    useConnectionsRefresh,
    wizardTargetOf,
} from "@/hooks/connections"
import type { AgentOption, Connection } from "@/modules/types"
import { ConnectionWizardOverlayBase } from "./component"
import type { WizardTargetView } from "./component"

/**
 * What a page that already read the workspace may hand the wizard drawer. A route that mounts the drawer on its own passes nothing:
 * the drawer then reads the connections, the active agents and the signed-in email itself.
 */
interface ConnectionWizardOverlayProps {
    readonly items?: ReadonlyArray<Connection>
    /** The workspace agents (any module); each provider offers the ones of its own module. */
    readonly agents?: ReadonlyArray<AgentOption>
    /** The signed-in person's email: the default recipient of the SMTP test message. */
    readonly ownerEmail?: string
}

/**
 * The wizard drawer of every provider. The URL says which one is open (`connect`, `conn`, and the return params of an OAuth login),
 * so a row, a library card and an OAuth return open the same drawer, and a refresh keeps it.
 */
export const ConnectionWizardOverlay = (props: ConnectionWizardOverlayProps) => {
    const t = useTranslations("connections")
    const refreshConnections = useConnectionsRefresh()
    const params = useSearchParams()
    const overlays = useConnectionOverlays()
    const data = useConnectionsData()
    const user = useQueryAuthUserSwr()
    const items = props.items ?? data.items
    const agents = props.agents ?? data.activeAgents
    const found = wizardTargetOf((name) => params.get(name), items)
    const def = found === null ? null : PROVIDERS[found.provider]
    const target: WizardTargetView | null =
        found === null || def === null ? null : { ...found, kind: def.kind, money: moneyProviderOf(found.provider) }
    // Every agent whose module may use this provider (purposeFor): chatbot, booking, loyalty, sales and shifts for chat, accounting for bank feeds.
    const eligible =
        target === null || def?.module === null
            ? []
            : agents.filter((agent) => purposeFor(agent.module, target.provider) !== null)
    const close = (changed: boolean) => {
        overlays.closeWizard()
        if (changed) void refreshConnections()
    }
    return (
        <ConnectionWizardOverlayBase
            props={{
                title: def === null ? "" : t(providerKey(def.id, "title")),
                closeLabel: t("close"),
                ownerEmail: props.ownerEmail ?? user.data?.email ?? "",
                target,
                agents,
                eligible,
                hasDefaultSender: items.some(
                    (item) => item.provider === found?.provider && item.status === "connected" && item.isDefault,
                ),
            }}
            on={{ close }}
        />
    )
}
