import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { InboxFeed } from "@/components/blocks/InboxFeed"
import { InboxPageLayout } from "@/components/composites/InboxPageLayout"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The document title of the page. */
export const inboxMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("inbox")
    return { title: t("title") }
}

/** Server shell for the GraphQL inbox feed. */
export const InboxPage = async () => {
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
            feed={<InboxFeed />}
        />
    )
}
