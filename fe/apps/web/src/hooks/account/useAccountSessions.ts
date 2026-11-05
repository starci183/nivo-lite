"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryMyAccountSwr } from "@/hooks/swr"
import type { DataSlot, SessionRowView } from "@/modules/types"
import { parseUserAgent } from "./account.shared"

const JUST_NOW_MS = 60_000

/** The devices signed in to the account, current one first, formatted for the locale. */
export const useAccountSessions = (): {
    readonly slot: DataSlot<ReadonlyArray<SessionRowView>>
    readonly reload: () => void
} => {
    const t = useTranslations("account")
    const format = useFormatter()
    const swrRead = useQueryMyAccountSwr()
    const { data } = swrRead
    const rows = useMemo((): ReadonlyArray<SessionRowView> => {
        const now = new Date()
        const when = (iso: string | null | undefined): string => {
            if (iso === null || iso === undefined) return "-"
            const at = new Date(iso)
            return now.getTime() - at.getTime() < JUST_NOW_MS ? t("justNow") : format.relativeTime(at, now)
        }
        const day = (iso: string | null | undefined): string =>
            iso === null || iso === undefined
                ? "-"
                : format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" })
        return [...(data?.sessions ?? [])]
            .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
            .map((session): SessionRowView => {
                const device = parseUserAgent(session.userAgent)
                return {
                    id: session.id,
                    device:
                        device.browser !== null && device.os !== null
                            ? t("deviceOn", { browser: device.browser, os: device.os })
                            : (device.browser ?? device.os ?? t("deviceUnknown")),
                    facts: [
                        t("created", { when: day(session.createdAt) }),
                        t("lastActive", { when: when(session.lastActiveAt) }),
                        session.ip === null ? null : `${t("ipLabel")} ${session.ip}`,
                    ]
                        .filter((part) => part !== null)
                        .join(" · "),
                    isCurrent: session.isCurrent,
                    isPhone: device.os === "iOS" || device.os === "Android",
                }
            })
    }, [data, format, t])
    return {
        slot: mapSlot(slotOfSwr(swrRead), () => rows),
        reload: () => void swrRead.mutate(),
    }
}
