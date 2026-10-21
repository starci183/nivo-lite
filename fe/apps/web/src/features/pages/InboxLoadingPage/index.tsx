import { getTranslations } from "next-intl/server"
import { InboxFeed } from "@/components/blocks/InboxFeed"
import { InboxPageLayout } from "@/components/composites/InboxPageLayout"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The same page while its data loads: the heading stays, the feed is skeleton rows. */
export const InboxLoadingPage = async () => {
    const t = await getTranslations("inbox")
    return (
        <InboxPageLayout
            crumbLabel={t("crumbLabel")}
            crumbs={[
                { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                { id: "inbox", label: t("title") },
            ]}
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description")}
            feed={<InboxFeed isLoading />}
        />
    )
}
