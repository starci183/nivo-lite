import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { brainHeadingOf } from "@/modules/brain"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { KnowledgeNivoPageBase } from "./component"

/** The document title of the page. */
export const knowledgeNivoMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("knowledge")
    return { title: t("nivoTitle") }
}

/** The words of the heading: they do not depend on the data. */
const headingOf = async (workspaceId?: string) => {
    const [t, brain] = await Promise.all([getTranslations("brain"), getTranslations("secondBrain")])
    return brainHeadingOf({
        crumbLabel: t("crumbLabel"),
        crumbHome: t("crumbHome"),
        homeHref: workspaceId === undefined ? undefined : workspaceHref(workspaceId, CONSOLE_ROUTES.dashboard),
        title: t("title"),
        description: brain("intro"),
    })
}

/** The base knowledge of NIVO per module: the connected screen reads it through GraphQL; read-only for every member. */
/** What the route hands the page: the workspace of the address. */
interface KnowledgeNivoPageProps {
    readonly workspaceId: string
}

/** The base knowledge of NIVO per module: the connected screen reads it through GraphQL; read-only for every member. */
export const KnowledgeNivoPage = async (props: KnowledgeNivoPageProps): Promise<ReactElement> => (
    <KnowledgeNivoPageBase props={{ heading: await headingOf(props.workspaceId) }} />
)

/** The same page while its data loads. */
export const KnowledgeNivoLoadingPage = async (): Promise<ReactElement> => (
    <KnowledgeNivoPageBase props={{ heading: await headingOf() }} />
)
