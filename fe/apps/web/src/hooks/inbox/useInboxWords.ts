"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { inboxCopyOf } from "@/modules/inbox"
import type { InboxCopy, InboxWords } from "@/modules/inbox"

/** What the inbox draws with: its fixed words, and the words and formats that depend on the moment and the locale. */
interface InboxVocabulary {
    readonly copy: InboxCopy
    readonly words: InboxWords
}

/** The inbox catalog, the formats of the reader's locale and the moment (read again every minute, so "2 min ago" keeps moving). */
export const useInboxWords = (): InboxVocabulary => {
    const t = useTranslations("inbox")
    const format = useFormatter()
    const now = useNow({ updateInterval: 60_000 })
    const translate: InboxWords["t"] = (key, values) => t(key, values)
    const minutesSince = (iso: string): number =>
        Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
    const words: InboxWords = {
        t: translate,
        now,
        money: (amount) => format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
        clock: (iso) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" }),
        date: (iso) => format.dateTime(new Date(iso), { day: "numeric", month: "short" }),
        ago: (iso) => {
            const minutes = minutesSince(iso)
            if (minutes < 1) return translate("justNow")
            if (minutes < 60) return translate("minutesAgo", { n: minutes })
            if (minutes < 60 * 24) return translate("hoursAgo", { n: Math.floor(minutes / 60) })
            return translate("daysAgo", { n: Math.floor(minutes / 1440) })
        },
    }
    return { copy: inboxCopyOf(translate), words }
}
