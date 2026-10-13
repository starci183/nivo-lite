"use client"

import { useTranslations } from "next-intl"
import { PROVIDER_LOGO, providerKey } from "@/hooks/connection-providers"
import { sortRows, statusKey, statusTone, useConnectionOverlays } from "@/hooks/connections"
import { useDeveloperWebhooks } from "@/hooks/developers"
import { isManager, useMember } from "@/hooks/member"
import { DevelopersPanelBase } from "./component"

/** The connected "Advanced" page body: the member's role decides page or 403, the outgoing webhooks come from the back end GraphQL API. */
export const DevelopersPanel = () => {
    const t = useTranslations("developers")
    const member = useMember()
    const tc = useTranslations("connections")
    const { webhooks, canManage } = useDeveloperWebhooks()
    const overlays = useConnectionOverlays()
    return (
        <DevelopersPanelBase
            state={{
                isAllowed: isManager(member),
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
            }}
            props={{
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
                backLabel: t("backToAutomations"),
                eventsTitle: t("eventsTitle"),
                eventsBody: t("eventsBody"),
                forbiddenTitle: t("forbiddenTitle"),
                forbiddenBody: t("forbiddenBody"),
                forbiddenBack: t("forbiddenBack"),
            }}
            on={{
                add: () => overlays.openWizard("webhook"),
                edit: (connectionId) => overlays.openWizard("webhook", connectionId),
            }}
        />
    )
}
