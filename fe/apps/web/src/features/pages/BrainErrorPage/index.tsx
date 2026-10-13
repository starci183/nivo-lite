import { useTranslations } from "next-intl"
import { BrainErrorPageBase } from "./component"

/** What the failed Second Brain route gives the page. */
interface BrainErrorPageProps {
    /** Retries the route (Next error boundary reset). */
    readonly onRetry: () => void
}

/** The Second Brain keeps its trail and heading when its data fails, with one Alert and a retry. */
export const BrainErrorPage = (props: BrainErrorPageProps) => {
    const t = useTranslations("brain")
    return (
        <BrainErrorPageBase
            props={{ crumbHome: t("crumbHome"), title: t("title"), message: t("loadFailed") }}
            on={{ retry: props.onRetry }}
        />
    )
}
