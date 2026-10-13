"use client"

import { useTranslations } from "next-intl"
import { useDeveloperWebhooks } from "@/hooks/developers"
import { isManager, useMember } from "@/hooks/member"
import { DevelopersPanelBase } from "./component"

/** The connected "Advanced" page body: the member's role decides page or 403, the outgoing webhooks come from the back end GraphQL API. */
export const DevelopersPanel = () => {
    const t = useTranslations("developers")
    const member = useMember()
    const { webhooks, canManage } = useDeveloperWebhooks()
    return (
        <DevelopersPanelBase
            state={{ isAllowed: isManager(member), webhooks, canManageWebhooks: canManage }}
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
        />
    )
}
