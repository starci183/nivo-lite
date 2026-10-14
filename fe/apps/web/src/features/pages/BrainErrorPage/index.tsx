import { useTranslations } from "next-intl"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { BrainErrorPageBase } from "./component"

/** What the failed Second Brain route gives the page. */
interface BrainErrorPageProps {
    /** Retries the route (Next error boundary reset). */
    readonly onRetry: () => void
}

/** The Second Brain keeps its trail and heading when its data fails, with one Alert and a retry. */
export const BrainErrorPage = (props: BrainErrorPageProps) => {
    const t = useTranslations("brain")
    const title = t("title")
    return (
        <BrainErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                    { id: "brain", label: title },
                ],
                title,
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
