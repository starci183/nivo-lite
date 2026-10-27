"use client"

import { useTranslations } from "next-intl"
import { useInboxFeed } from "@/hooks/inbox"
import { useSlotLabels } from "@/hooks/slot"
import { InboxFeedBase } from "./component"

/** Reads the GraphQL feed, localizes its rows and revalidates its SWR cache on demand. */
export const InboxFeed = () => {
    const t = useTranslations("inbox")
    const slotLabels = useSlotLabels()
    const feed = useInboxFeed()
    return (
        <InboxFeedBase
            props={{
                ariaLabel: t("feedAria"),
                title: t("feedTitle"),
                description: t("feedDesc"),
                refreshLabel: t("feedRefresh"),
                slot: feed.slot,
                labels: slotLabels(t("feedEmptyTitle")),
            }}
            on={{ refresh: feed.refresh }}
        />
    )
}
