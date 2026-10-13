import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getFormatter, getLocale, getTranslations } from "next-intl/server"
import { adminFormat, detailCards, detailFacts } from "@/hooks/admin"
import { readAdminWorkspace } from "@/modules/api"
import { readApiToken } from "@/modules/db"
import { AdminWorkspacePageBase } from "./component"

/** What the route hands the page: the workspace id of the address. */
type AdminWorkspacePageProps = {
    readonly params: Promise<{ readonly id: string }>
}

/** The document title of the page. */
export const adminWorkspaceMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("admin")
    return { title: t("workspaceEyebrow") }
}

/** The /admin/[id] screen body: the read-only overview of one workspace and the confirmed support actions. */
export const AdminWorkspacePage = async (props: AdminWorkspacePageProps) => {
    const t = await getTranslations("admin")
    const format = adminFormat(await getFormatter(), t, new Date())
    const { id } = await props.params
    const token = await readApiToken()
    if (token.kind !== "ok") notFound()
    const detail = await readAdminWorkspace({ token: token.value, locale: await getLocale(), workspaceId: id })
    if (detail.kind === "unavailable") throw new Error(`admin: workspace ${detail.fault.code}`)
    if (detail.kind !== "ok") notFound()
    const { workspace, credits, invites } = detail.value
    const facts = detailFacts(detail.value, format, t)
    return (
        <AdminWorkspacePageBase
            props={{
                eyebrow: t("workspaceEyebrow"),
                title: workspace.name,
                description: t("workspaceDescription", {
                    owner: workspace.ownerEmail ?? t("empty"),
                    created: format.date(workspace.createdAt),
                    id: workspace.id,
                }),
                allWorkspacesLabel: t("allWorkspaces"),
                overviewTitle: t("overviewTitle"),
                billing: facts.billing,
                activity: facts.activity,
                workspaceId: workspace.id,
                status: workspace.status,
                planCode: workspace.planCode,
                creditsLimit: credits.ownLimit,
                invites: invites.map((invite) => ({ id: invite.id, email: invite.email })),
                cards: detailCards(detail.value, format, t),
            }}
        />
    )
}
