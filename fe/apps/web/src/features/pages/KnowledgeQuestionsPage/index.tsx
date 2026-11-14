import type { ReactElement } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import type { PageHeaderContent } from "@starci/grammar/common"
import { isKnowledgeId } from "@/modules/documents"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES, workspaceHref } from "@/modules/routes"
import { KnowledgeQuestionsLoadingPageBase, KnowledgeQuestionsPageBase } from "./component"

/** The document title of the page. */
export const knowledgeQuestionsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("brainCritique")
    return { title: t("pageTitle") }
}

/** The header of the page, resolved on the server so the page and its loading state say the same: the trail, the title and its line. */
const headerOf = async (workspaceId?: string): Promise<PageHeaderContent> => {
    const [t, brain, docs] = await Promise.all([
        getTranslations("brainCritique"),
        getTranslations("brain"),
        getTranslations("knowledge"),
    ])
    const link = (path: string) => (workspaceId === undefined ? {} : { href: workspaceHref(workspaceId, path) })
    return {
        breadcrumbs: {
            label: brain("crumbLabel"),
            items: [
                { id: "home", label: brain("crumbHome"), ...link(CONSOLE_ROUTES.workspaceHome) },
                { id: "brain", label: docs("crumbBrain"), ...link(KNOWLEDGE_ROUTES.brain) },
                { id: "docs", label: docs("title"), ...link(KNOWLEDGE_ROUTES.library) },
                { id: "current", label: t("pageCrumb") },
            ],
        },
        title: t("pageTitle"),
        description: t("pageDescription"),
    }
}

/** What the page reads the document from: the `id` segment of the address. */
interface KnowledgeQuestionsPageProps {
    readonly workspaceId: string
    readonly sourceId: string
}

/** The questions of one document: the connected blocks read them through GraphQL; a bad id is not found. */
export const KnowledgeQuestionsPage = async (props: KnowledgeQuestionsPageProps): Promise<ReactElement> => {
    if (!isKnowledgeId(props.sourceId)) notFound()
    return (
        <KnowledgeQuestionsPageBase props={{ header: await headerOf(props.workspaceId), sourceId: props.sourceId }} />
    )
}

/** The same page while it loads: the real header and the skeleton of its blocks. */
export const KnowledgeQuestionsLoadingPage = async (): Promise<ReactElement> => (
    <KnowledgeQuestionsLoadingPageBase props={{ header: await headerOf() }} />
)
