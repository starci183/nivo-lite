import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { listConnections } from "@/lib/channels"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { apiUrl } from "@/modules/config"
import { readApiKeys } from "@/modules/db"
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
    const [webhooks, keys] = await Promise.all([
        listConnections(me.workspaceId, "webhook"),
        readApiKeys(me.workspaceId),
    ])
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
                workspaceId: me.workspaceId,
                webhooks,
                canManageWebhooks: me.role === "owner",
                keys:
                    keys.kind === "ok"
                        ? keys.value.map((key) => ({
                              id: key.id,
                              name: key.name,
                              prefix: key.key_prefix,
                              createdAt: key.created_at,
                              lastUsedAt: key.last_used_at,
                              revokedAt: key.revoked_at,
                          }))
                        : [],
                keysFailed: keys.kind !== "ok",
                apiBase: `${apiUrl()}/api/v1`,
            }}
        />
    )
}
