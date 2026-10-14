import { useTranslations } from "next-intl"
import { InboxErrorPageBase } from "./component"

/** What the route gives the failure view: the segment retry. */
interface InboxErrorPageProps {
    readonly onRetry: () => void
}

/** STATE-8 case-4: the Inbox keeps its trail and heading when its data fails, with one Alert and a retry. */
export const InboxErrorPage = (props: InboxErrorPageProps) => {
    const t = useTranslations("inbox")
    const title = t("title")
    return (
        <InboxErrorPageBase
            props={{
                crumbs: [
                    { id: "home", label: t("crumbHome"), href: "/dashboard" },
                    { id: "inbox", label: title },
                ],
                title,
                message: t("loadFailBody"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
