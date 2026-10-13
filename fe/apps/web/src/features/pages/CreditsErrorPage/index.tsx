import { useTranslations } from "next-intl"
import { CreditsErrorPageBase } from "./component"

/** What the failed credits route gives the page. */
type CreditsErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The credits page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const CreditsErrorPage = (props: CreditsErrorPageProps) => {
    const t = useTranslations("credits")
    return (
        <CreditsErrorPageBase
            props={{ crumbHome: t("crumbHome"), title: t("title"), message: t("errorText") }}
            on={{ retry: props.onRetry }}
        />
    )
}
