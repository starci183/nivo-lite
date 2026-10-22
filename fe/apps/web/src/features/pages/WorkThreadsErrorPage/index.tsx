import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { WorkThreadsErrorPageBase } from "./component"

/** What the route error boundary hands over. */
interface WorkThreadsErrorPageProps {
    readonly onRetry: () => void
}

/** The work threads page keeps its trail and heading when it fails: the words are settled here. */
export const WorkThreadsErrorPage = (props: WorkThreadsErrorPageProps) => {
    const t = useTranslations("workThreads")
    return (
        <WorkThreadsErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "threads", label: t("pageTitle") },
                ],
                title: t("pageTitle"),
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
