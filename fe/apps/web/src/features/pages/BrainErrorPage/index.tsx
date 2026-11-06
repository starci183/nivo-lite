import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { BrainErrorPageBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the failed Second Brain route gives the page. */
interface BrainErrorPageProps {
    /** Retries the route (Next error boundary reset). */
    readonly onRetry: () => void
}

/** The Second Brain keeps its trail and heading when its data fails, with one Alert and a retry. */
export const BrainErrorPage = (props: BrainErrorPageProps) => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("brain")
    const title = t("title")
    return (
        <BrainErrorPageBase
            props={{
                crumbs: [
                    {
                        id: "home",
                        label: t("crumbHome"),
                        href: workspaceHref(workspaceId, CONSOLE_ROUTES.workspaceHome),
                    },
                    { id: "brain", label: title },
                ],
                title,
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
