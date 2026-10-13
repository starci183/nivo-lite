"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { purposeFor } from "@/hooks/connection-access"
import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { moneyProviderOf, useConnectionOverlays, wizardTargetOf } from "@/hooks/connections"
import { navigation } from "@/modules/i18n"
import type { AgentOption, Connection } from "@/modules/types"
import { ConnectionWizardOverlayBase } from "./component"
import type { WizardTargetView } from "./component"

/** What the page that read the workspace hands the wizard drawer. */
type ConnectionWizardOverlayProps = {
    readonly workspaceId: string
    readonly items: ReadonlyArray<Connection>
    /** The workspace agents (any module); each provider offers the ones of its own module. */
    readonly agents: ReadonlyArray<AgentOption>
    /** The signed-in person's email: the default recipient of the SMTP test message. */
    readonly ownerEmail: string
}

/**
 * The wizard drawer of every provider. The URL says which one is open (`connect`, `conn`, and the return params of an OAuth login),
 * so a row, a library card and an OAuth return open the same drawer, and a refresh keeps it.
 */
export const ConnectionWizardOverlay = (props: ConnectionWizardOverlayProps) => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const params = useSearchParams()
    const overlays = useConnectionOverlays()
    const found = wizardTargetOf((name) => params.get(name), props.items)
    const def = found === null ? null : PROVIDERS[found.provider]
    const target: WizardTargetView | null =
        found === null || def === null ? null : { ...found, kind: def.kind, money: moneyProviderOf(found.provider) }
    // Every agent whose module may use this provider (purposeFor): chatbot, booking, loyalty, sales and shifts for chat, accounting for bank feeds.
    const eligible =
        target === null || def?.module === null
            ? []
            : props.agents.filter((agent) => purposeFor(agent.module, target.provider) !== null)
    const close = (changed: boolean) => {
        overlays.closeWizard()
        if (changed) router.refresh()
    }
    return (
        <ConnectionWizardOverlayBase
            props={{
                title: def === null ? "" : t(providerKey(def.id, "title")),
                closeLabel: t("close"),
                workspaceId: props.workspaceId,
                ownerEmail: props.ownerEmail,
                target,
                agents: props.agents,
                eligible,
                hasDefaultSender: props.items.some(
                    (item) => item.provider === found?.provider && item.status === "connected" && item.isDefault,
                ),
            }}
            on={{ close }}
        />
    )
}
