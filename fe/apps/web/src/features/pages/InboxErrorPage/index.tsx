import { useTranslations } from "next-intl"
import { RouteError } from "@/components/blocks/RouteError"

/** What the route gives the failure view: the segment retry. */
interface InboxErrorPageProps {
    readonly onRetry: () => void
}

/** STATE-8 case-4: the Inbox keeps its trail and heading when its data fails, with one Alert and a retry. */
export const InboxErrorPage = (props: InboxErrorPageProps) => {
    const t = useTranslations("inbox")
    return (
        <RouteError
            crumbs={[
                { id: "home", label: t("crumbHome"), href: "/dashboard" },
                { id: "inbox", label: t("title") },
            ]}
            title={t("title")}
            message={t("loadFailBody")}
            onRetry={props.onRetry}
        />
    )
}
