"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { PROVIDER_LOGO, providerKey } from "@/hooks/connection-providers"
import { sortRows, statusKey, statusTone, useConnectionOverlays } from "@/hooks/connections"
import { useDeveloperWebhooks } from "@/hooks/developers"
import { isManager, useMember } from "@/hooks/member"
import { useSlotLabels } from "@/hooks/slot"
import { DevelopersPanelBase } from "./component"

/** The one line under a webhook: its masked address and the events it receives, in the owner's words. */
const webhookLineOf = (meta: Readonly<Record<string, string>>, eventLabel: (event: string) => string): string =>
    [
        meta.url_masked ?? meta.host ?? "",
        (meta.events ?? "")
            .split(",")
            .map((event) => event.trim())
            .filter((event) => event !== "")
            .map(eventLabel)
            .join(", "),
    ]
        .filter((part) => part !== "")
        .join(" \u00b7 ")

/** The sections the page draws under the outgoing events. */
type DevelopersPanelProps = {
    readonly children: ReactNode
}

/** The connected "Advanced" page: the member's role decides page or 403, the outgoing webhooks come from the back end GraphQL API. */
export const DevelopersPanel = (props: DevelopersPanelProps) => {
    const t = useTranslations("developers")
    const member = useMember()
    const tc = useTranslations("connections")
    const ta = useTranslations("automations")
    const tw = useTranslations("webhookWizard")
    const { webhooks, canManage, read, retry } = useDeveloperWebhooks()
    const slotLabels = useSlotLabels()
    const overlays = useConnectionOverlays()
    return (
        <DevelopersPanelBase
            children={props.children}
            props={{
                access: isManager(member) ? { items: true } : { isForbidden: true },
                webhooks: sortRows(webhooks).map((connection) => ({
                    id: connection.id,
                    name: connection.name,
                    description: webhookLineOf(connection.meta, (event) =>
                        tw.has(`event_${event.replace(".", "_")}`) ? tw(`event_${event.replace(".", "_")}`) : event,
                    ),
                    isIncomplete: connection.status === "pending",
                    statusLabel: tc(statusKey(connection.status)),
                    tone: statusTone(connection.status),
                })),
                canManageWebhooks: canManage,
                webhooksRead: read,
                webhooksView: {
                    title: tc(providerKey("webhook", "title")),
                    fact: tc("connectionCount", { count: webhooks.length }),
                    blurb: tc(providerKey("webhook", "blurb")),
                    notConnected: tc("notConnected"),
                    logo: PROVIDER_LOGO.webhook,
                    addLabel: tc("add"),
                    connectLabel: tc("connect"),
                    editLabel: tc("edit"),
                    continueLabel: tc("continue"),
                },
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                crumbAutomations: ta("title"),
                title: t("title"),
                description: t("description"),
                eventsTitle: t("eventsTitle"),
                eventsBody: t("eventsBody"),
                slotLabels: { ...slotLabels(t("title")), forbidden: t("forbiddenBody") },
            }}
            on={{
                retry,
                add: () => overlays.openWizard("webhook"),
                edit: (connectionId) => overlays.openWizard("webhook", connectionId),
            }}
        />
    )
}
