import { useTranslations } from "next-intl"
import { TeamErrorPageBase } from "./component"

/** What the failed team route gives the page. */
type TeamErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The team page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const TeamErrorPage = (props: TeamErrorPageProps) => {
    const t = useTranslations("team")
    return (
        <TeamErrorPageBase
            props={{ crumbHome: t("crumbHome"), title: t("title"), message: t("loadFailBody") }}
            on={{ retry: props.onRetry }}
        />
    )
}
