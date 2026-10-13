"use client"

import { useTranslations } from "next-intl"
import { useInboxFeed } from "@/hooks/inbox"
import { InboxFeedBase } from "./component"

/** Props for the connected inbox feed. */
interface InboxFeedProps {
    /** STATE-8: the feed is loading - its heading stays, the rows are three skeleton rows. */
    readonly isLoading?: boolean
}

/** Reads the GraphQL feed, localizes its rows and revalidates its SWR cache on demand. */
export const InboxFeed = (props: InboxFeedProps) => {
    const t = useTranslations("inbox")
    const feed = useInboxFeed(props.isLoading === true)
    return (
        <InboxFeedBase
            props={{
                ariaLabel: t("feedAria"),
                title: t("feedTitle"),
                description: t("feedDesc"),
                refreshLabel: t("feedRefresh"),
                emptyTitle: t("feedEmptyTitle"),
                emptyBody: t("feedEmptyBody"),
                isLoading: feed.isLoading,
                error: feed.error,
                errorTitle: t("loadFailTitle"),
                rows: feed.rows,
            }}
            on={{ refresh: feed.refresh }}
        />
    )
}
