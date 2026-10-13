import { useTranslations } from "next-intl"
import { AccountErrorPageBase } from "./component"

/** What the failed account route gives the page. */
type AccountErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The account page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const AccountErrorPage = (props: AccountErrorPageProps) => {
    const t = useTranslations("account")
    return (
        <AccountErrorPageBase
            props={{ crumbHome: t("crumbHome"), title: t("title"), message: t("loadFailed") }}
            on={{ retry: props.onRetry }}
        />
    )
}
