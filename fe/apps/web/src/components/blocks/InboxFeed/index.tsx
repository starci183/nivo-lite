"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useInboxFeed } from "@/hooks/inbox"
import { paneGridOf, usePaneCopy, usePanePhone } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { InboxFeedBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** Reads the GraphQL feed, localizes its rows and revalidates its SWR cache on demand; the opened input and the phone pane live here. */
export const InboxFeed = () => {
    const t = useTranslations("inbox")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const feed = useInboxFeed()
    const phone = usePanePhone()
    const [chosen, setChosen] = useState<string | null>(null)
    const rows = "items" in feed.slot ? feed.slot.items : []
    const repeats = rows.reduce((sum, row) => sum + row.duplicates, 0)
    const selectedId = rows.some((row) => row.id === chosen) ? chosen : (rows[0]?.id ?? null)
    return (
        <InboxFeedBase
            props={{
                copy: {
                    grid: t("gridLabel"),
                    title: t("title"),
                    pageBody: t("pageBody"),
                    listLabel: t("listLabel"),
                    detailLabel: t("detailLabel"),
                    pickTitle: t("pickTitle"),
                    pickBody: t("pickBody"),
                    emptyBody: t("emptyBody"),
                    emptyAction: t("emptyAction"),
                    errorBody: t("errorBody"),
                    refresh: pane.refresh,
                    back: pane.backToList,
                    moreActions: pane.moreActions,
                    contentTitle: t("contentTitle"),
                    quoteSource: t("quoteSource"),
                    detailsTitle: t("detailsTitle"),
                    duplicatesNote: t("duplicatesNote"),
                    terms: {
                        from: t("termFrom"),
                        contact: t("termContact"),
                        channel: t("termChannel"),
                        kind: t("termKind"),
                        received: t("termReceived"),
                        lead: t("termLead"),
                        duplicates: t("termDuplicates"),
                    },
                },
                summary: repeats > 0 ? t("summaryDuplicates", { n: repeats }) : t("summary"),
                slot: feed.slot,
                isWaiting: feed.isWaiting,
                labels: { ...slotLabels(t("emptyTitle")), error: t("errorTitle") },
                selectedId,
                grid: paneGridOf({ hasList: true, hasAside: false, phone: phone.phone }),
            }}
            on={{
                refresh: feed.refresh,
                select: (id) => {
                    setChosen(id)
                    phone.showMain()
                },
                back: phone.showList,
                go: (href) => router.push(href),
                openConnections: () => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.connections)),
            }}
        />
    )
}
