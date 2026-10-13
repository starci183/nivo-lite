import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
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

/** Home after sign-in. The proxy gates the route; the list of workspaces is read in the browser from the back end GraphQL API. */
export const WorkspacesPage = async (props: WorkspacesPageProps) => {
    const { reason } = await props.searchParams
    const t = await getTranslations("onboarding")
    return <WorkspacesPageBase props={{ title: t("workspacesTitle"), reason }} />
}
