import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import { KnowledgeErrorPageBase } from "./component"

/** What the failed knowledge route gives the page. */
interface KnowledgeErrorPageProps {
    /** Retries the route (Next error boundary reset). */
    readonly onRetry: () => void
    /** The deeper page that failed, or nothing for the documents list. */
    readonly current?: "source" | "nivo"
}

/** A knowledge page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const KnowledgeErrorPage = (props: KnowledgeErrorPageProps) => {
    const t = useTranslations("knowledge")
    const isDeeper = props.current !== undefined
    return (
        <KnowledgeErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "brain", label: t("crumbBrain"), href: KNOWLEDGE_ROUTES.brain },
                    isDeeper
                        ? { id: "docs", label: t("title"), href: KNOWLEDGE_ROUTES.library }
                        : { id: "docs", label: t("title") },
                    ...(props.current === "nivo" ? [{ id: "current", label: t("nivoTitle") }] : []),
                ],
                title: props.current === "nivo" ? t("nivoTitle") : t("title"),
                message: t("loadFailBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
