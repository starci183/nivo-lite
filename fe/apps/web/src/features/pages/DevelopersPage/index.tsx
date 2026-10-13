import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { listConnections } from "@/lib/channels"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { developerApiUrl } from "@/modules/config"
import { DevelopersForbiddenBase, DevelopersPageBase } from "./component"

/** The document title of the page. */
export const developersMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("developers")
    return { title: t("title") }
}

/** The "Advanced" page body (owner or manager): outgoing webhooks, API keys, the quick guide. Staff see a friendly 403. */
export const DevelopersPage = async () => {
    const t = await getTranslations("developers")
    const me = await getCurrentMember()
    if (!isManagerRole(me.role)) {
        return (
            <DevelopersForbiddenBase
                props={{
                    eyebrow: t("eyebrow"),
                    title: t("forbiddenTitle"),
                    body: t("forbiddenBody"),
                    backLabel: t("forbiddenBack"),
                }}
            />
        )
    }
    const webhooks = await listConnections(me.workspaceId, "webhook")
    return (
        <DevelopersPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
                backLabel: t("backToAutomations"),
                eventsTitle: t("eventsTitle"),
                eventsBody: t("eventsBody"),
                webhooks,
                canManageWebhooks: me.role === "owner",
                apiBase: `${developerApiUrl()}/api/v1`,
            }}
        />
    )
}
