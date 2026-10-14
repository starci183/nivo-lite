import { useTranslations } from "next-intl"
import { APP_ROUTES } from "@/modules/routes"
import { AccountErrorPageBase } from "./component"

/** What the failed account route gives the page. */
type AccountErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The account page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const AccountErrorPage = (props: AccountErrorPageProps) => {
    const t = useTranslations("account")
    const title = t("title")
    return (
        <AccountErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "account", label: title },
                ],
                title,
                message: t("loadFailed"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
