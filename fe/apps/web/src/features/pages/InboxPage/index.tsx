import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { InboxFeed } from "@/components/blocks/InboxFeed"

/** The document title of the page. */
export const inboxMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("inbox")
    return { title: t("title") }
}

/** The inbox route: the feed block is its root and draws the one `Page` of list and detail panes. */
export const InboxPage = () => <InboxFeed />
