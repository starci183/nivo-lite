"use client"

import { connectionPageOf, pollConnectionPage } from "@/hooks/connectionPage"
import { useQueryTelegramConnectionPageSwr } from "@/hooks/swr"
import { TELEGRAM_PAGE_POLL_MS } from "./telegramConnection.shared"

/**
 * The page of one Telegram bot connection, asked again, fast while the connection needs attention and slowly while it is healthy; `isMissing` once the back end says no
 * such connection exists (an id it does not know, one of another provider, or one that is no id).
 */
export const useTelegramPage = (connectionId: string | undefined) =>
    connectionPageOf(
        useQueryTelegramConnectionPageSwr(connectionId, { refreshInterval: pollConnectionPage(TELEGRAM_PAGE_POLL_MS) }),
    )

/** What one read of the page answers. */
export type TelegramPageData = NonNullable<ReturnType<typeof useTelegramPage>["slot"]["items"]>
