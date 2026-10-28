"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { PROVIDER_LOGO, providerKey } from "@/hooks/connection-providers"
import { sortRows, statusKey, statusTone, useConnectionOverlays } from "@/hooks/connections"
import { useDeveloperWebhooks } from "@/hooks/developers"
import { isManager, useMember } from "@/hooks/member"
import { useSlotLabels } from "@/hooks/slot"
import { DevelopersPanelBase } from "./component"

/** The sections the page draws under the outgoing events. */
type DevelopersPanelProps = {
    readonly children: ReactNode
}

/** The connected "Advanced" page: the member's role decides page or 403, the outgoing webhooks come from the back end GraphQL API. */
export const DevelopersPanel = (props: DevelopersPanelProps) => {
    const t = useTranslations("developers")
    const member = useMember()
    const tc = useTranslations("connections")
    const { webhooks, canManage } = useDeveloperWebhooks()
    const slotLabels = useSlotLabels()
    const overlays = useConnectionOverlays()
    return (
        <DevelopersPanelBase
            shape={{ body: props.children }}
            props={{
                access: isManager(member) ? { items: true } : { isForbidden: true },
                webhooks: sortRows(webhooks).map((connection) => ({
                    id: connection.id,
                    name: connection.name,
                    statusLabel: tc(statusKey(connection.status)),
                    tone: statusTone(connection.status),
                })),
                canManageWebhooks: canManage,
                webhooksView: {
                    title: tc(providerKey("webhook", "title")),
                    fact: tc("connectionCount", { count: webhooks.length }),
                    blurb: tc(providerKey("webhook", "blurb")),
                    notConnected: tc("notConnected"),
                    logo: PROVIDER_LOGO.webhook,
                    addLabel: tc("add"),
                    connectLabel: tc("connect"),
                    editLabel: tc("edit"),
                },
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                title: t("title"),
                description: t("description"),
                backLabel: t("backToAutomations"),
                eventsTitle: t("eventsTitle"),
                eventsBody: t("eventsBody"),
                slotLabels: { ...slotLabels(t("title")), forbidden: t("forbiddenBody") },
            }}
            on={{
                add: () => overlays.openWizard("webhook"),
                edit: (connectionId) => overlays.openWizard("webhook", connectionId),
            }}
        />
    )
}
