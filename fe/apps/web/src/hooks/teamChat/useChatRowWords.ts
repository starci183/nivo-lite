"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { useMemo } from "react"
import type { ChatRowWords } from "./teamChat.shared"

/** How often the clock of the rows is read again (milliseconds). */
const CLOCK_REFRESH_MS = 60_000

/** The clocks and words a room row or a message row needs, in the viewer's language. */
export const useChatRowWords = (): ChatRowWords => {
    const t = useTranslations("teamChat")
    const format = useFormatter()
    const now = useNow({ updateInterval: CLOCK_REFRESH_MS })
    return useMemo(
        () => ({
            now,
            timeOf: (iso: string) =>
                format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", hour12: false }),
            dateOf: (iso: string) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" }),
            dateWithYearOf: (iso: string) =>
                format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" }),
            today: t("dayToday"),
            yesterday: t("dayYesterday"),
            noMessage: t("noMessageYet"),
            attachment: t("attachmentLine"),
        }),
        [format, now, t],
    )
}
