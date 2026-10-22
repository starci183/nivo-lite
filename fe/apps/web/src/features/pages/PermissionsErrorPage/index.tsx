import { useTranslations } from "next-intl"
import { APP_ROUTES } from "@/modules/routes"
import { PermissionsErrorPageBase } from "./component"

/** What the failed permissions route gives the page. */
type PermissionsErrorPageProps = {
    /** Retries the route (Next's error boundary `reset`). */
    readonly onRetry: () => void
}

/** The permissions page keeps its trail and heading when its data fails, with one Alert and a retry. */
export const PermissionsErrorPage = (props: PermissionsErrorPageProps) => {
    const t = useTranslations("permissions")
    const title = t("title")
    return (
        <PermissionsErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: APP_ROUTES.dashboard },
                    { id: "permissions", label: title },
                ],
                title,
                message: t("loadFailBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
