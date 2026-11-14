"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { bindableOf, useBindableAgents } from "@/hooks/bindable-agents"
import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { useQueryAuthUserSwr } from "@/hooks/auth"
import {
    mayConnect,
    moneyProviderOf,
    useConnectionOverlays,
    useConnectionsData,
    useConnectionsRefresh,
    useConnectionsRole,
    wizardTargetOf,
} from "@/hooks/connections"
import { slotOfReads, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import type { AgentOption, Connection, DataSlot } from "@/modules/types"
import { ConnectionWizardOverlayBase, type WizardBoard, type WizardTargetView } from "./component"

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
 * so a row, a library card and an OAuth return open the same drawer, and a refresh keeps it. A role that may not finish the wizard
 * never sees it, whatever the URL says.
 */
export const ConnectionWizardOverlay = (props: ConnectionWizardOverlayProps) => {
    const t = useTranslations("connections")
    const refreshConnections = useConnectionsRefresh()
    const params = useSearchParams()
    const overlays = useConnectionOverlays()
    const data = useConnectionsData()
    const access = useConnectionsRole()
    const { role } = access
    const slotLabelsOf = useSlotLabels()
    // The signed-in person only prefills the SMTP test recipient: the drawer never waits on it.
    const user = slotOfSwr(useQueryAuthUserSwr())
    const items = props.items ?? data.items
    const agents = props.agents ?? data.activeAgents
    const asked = wizardTargetOf((name) => params.get(name), items)
    const found = asked !== null && mayConnect(role, asked.provider) ? asked : null
    const def = found === null ? null : PROVIDERS[found.provider]
    const target: WizardTargetView | null =
        found === null || def === null ? null : { ...found, kind: def.kind, money: moneyProviderOf(found.provider) }
    // Every agent the back end says may be bound to a connection of this provider, with what it would do there. Until it answers
    // the board loads, so the wizard never offers a guessed pair.
    const bindable = useBindableAgents(target?.provider)
    const eligible = target === null ? [] : bindableOf(agents, bindable.data ?? [])
    const board: WizardBoard = {
        agents,
        eligible,
        hasDefaultSender: items.some(
            (item) => item.provider === found?.provider && item.status === "connected" && item.isDefault,
        ),
    }
    const hasOwnRead = props.items === undefined || props.agents === undefined
    const dependencyReads = [access.read, ...(hasOwnRead ? data.reads : []), bindable]
    const slot: DataSlot<WizardBoard> = slotOfReads(dependencyReads, () => board)
    const retry = () => {
        access.retry()
        if (hasOwnRead) data.retry()
        void bindable.mutate()
    }
    const close = (changed: boolean) => {
        overlays.closeWizard()
        if (changed) void refreshConnections()
    }
    return (
        <ConnectionWizardOverlayBase
            props={{
                title: def === null ? "" : t(providerKey(def.id, "title")),
                closeLabel: t("close"),
                ownerEmail: props.ownerEmail ?? ("items" in user ? user.items?.email : undefined) ?? "",
                target,
                board: slot,
                dependencyReads,
                slotLabels: slotLabelsOf(""),
            }}
            on={{ close, retry }}
        />
    )
}
