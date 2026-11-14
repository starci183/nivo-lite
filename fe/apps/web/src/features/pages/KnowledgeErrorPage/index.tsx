import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES, workspaceHref } from "@/modules/routes"
import { KnowledgeErrorPageBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the failed knowledge route gives the page. */
interface KnowledgeErrorPageProps {
    /** Retries the route (Next error boundary reset). */
    readonly onRetry: () => void
    /** The deeper page that failed, or nothing for the documents list. */
    readonly current?: "source" | "nivo" | "questions"
}

/** A knowledge page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const KnowledgeErrorPage = (props: KnowledgeErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("knowledge")
    const critique = useTranslations("brainCritique")
    const isDeeper = props.current !== undefined
    const pageTitle = props.current === "questions" ? critique("pageTitle") : t("title")
    const title = props.current === "nivo" ? t("nivoTitle") : pageTitle
    return (
        <KnowledgeErrorPageBase
            props={{
                crumbs: [
                    {
                        id: "home",
                        label: t("crumbHome"),
                        href: workspaceHref(workspaceId, CONSOLE_ROUTES.workspaceHome),
                    },
                    { id: "brain", label: t("crumbBrain"), href: workspaceHref(workspaceId, KNOWLEDGE_ROUTES.brain) },
                    isDeeper
                        ? { id: "docs", label: t("title"), href: workspaceHref(workspaceId, KNOWLEDGE_ROUTES.library) }
                        : { id: "docs", label: t("title") },
                    ...(props.current === "nivo" ? [{ id: "current", label: t("nivoTitle") }] : []),
                    ...(props.current === "questions" ? [{ id: "current", label: critique("pageCrumb") }] : []),
                ],
                title,
                message: t("loadFailBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
