import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { workspaceRoleOf, workspaceStateOf } from "@/hooks/workspaces"
import type { WorkspaceCardView } from "@/hooks/workspaces"
import { getPrincipal, readMemberships } from "@/modules/db"
import { navigation } from "@/modules/i18n"
import { loginPath } from "@/modules/routes"
import { WorkspacesPageBase } from "./component"

/** What the route passes through: the query of the workspaces URL. */
interface WorkspacesPageProps {
    readonly searchParams: Promise<{ readonly reason?: string }>
}

/** The document title of the page. */
export const workspacesMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("onboarding")
    return { title: t("workspacesTitle") }
}

/** Home after sign-in: the workspaces the person belongs to (from the back end api), and the way to create one or join by link. */
export const WorkspacesPage = async (props: WorkspacesPageProps) => {
    const { reason } = await props.searchParams
    const locale = await getLocale()
    const principal = await getPrincipal()
    if (principal.kind !== "ok") navigation.redirect({ href: loginPath(), locale })
    const memberships = await readMemberships()
    if (memberships.kind !== "ok") throw new Error(`workspaces: ${memberships.kind} ${memberships.code}`)
    const t = await getTranslations("onboarding")
    const workspaces = memberships.value
        .filter((membership) => membership.memberStatus === "active")
        .map((membership): WorkspaceCardView => ({
            id: membership.workspaceId,
            name: membership.name,
            role: workspaceRoleOf(membership.role),
            state: workspaceStateOf(membership.status),
        }))
    return (
        <WorkspacesPageBase
            props={{
                email: principal.kind === "ok" ? (principal.value.email ?? "") : "",
                title: t("workspacesTitle"),
                description: t("workspacesText"),
                createLabel: t("createNew"),
                createFirstLabel: t("createFirst"),
                welcomeTitle: t("welcomeTitle"),
                welcomeText: t("welcomeText"),
                welcomeStepsLabel: t("welcomeStepsLabel"),
                welcomeSteps: [t("welcomeStep1"), t("welcomeStep2"), t("welcomeStep3")],
                reason: reason === "disabled" ? t("reasonDisabled") : undefined,
                workspaces,
            }}
        />
    )
}
