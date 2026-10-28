import { Page } from "@starci/grammar/common"
import { getTranslations } from "next-intl/server"
import { InboxFeed } from "@/components/blocks/InboxFeed"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The same page while its data loads: the heading stays, the feed is skeleton rows. */
export const InboxLoadingPage = async () => {
    const t = await getTranslations("inbox")
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: {
                    label: t("crumbLabel"),
                    items: [
                        { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                        { id: "inbox", label: t("title") },
                    ],
                },
                meta: t("eyebrow"),
                title: t("title"),
                description: t("description"),
            }}
        >
            <InboxFeed />
        </Page>
    )
}
