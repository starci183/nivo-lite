"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { useInstallations } from "@/hooks/installations"
import { useWorkspaceId } from "@/hooks/workspaces"
import { workspaceHref } from "@/modules/routes"
import { messagesCopyOf } from "./teamChat.copy"
import { stopCardWordsOf, type ChatRowWords } from "./teamChat.shared"

/** How often the clock of the rows is read again (milliseconds). */
const CLOCK_REFRESH_MS = 60_000

/** The clocks and words a room row or a message row needs, in the viewer's language. */
export const useChatRowWords = (): ChatRowWords => {
    const t = useTranslations("teamChat")
    const format = useFormatter()
    const now = useNow({ updateInterval: CLOCK_REFRESH_MS })
    const { installations } = useInstallations()
    const workspaceId = useWorkspaceId()
    const pictureOf = useCallback(
        (name: string): string | null =>
            installations?.find((installation) => installation.name === name)?.agentAvatarUrl ?? null,
        [installations],
    )
    return useMemo(() => {
        const timeOf = (iso: string): string =>
            format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", hour12: false })
        return {
            now,
            timeOf,
            dateOf: (iso: string) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" }),
            dateWithYearOf: (iso: string) =>
                format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" }),
            today: t("dayToday"),
            yesterday: t("dayYesterday"),
            noMessage: t("noMessageYet"),
            you: t("previewYou"),
            attachment: t("attachmentLine"),
            pictureOf,
            copy: messagesCopyOf(t),
            stop: stopCardWordsOf(t, timeOf),
            hrefOf: (path: string) => workspaceHref(workspaceId, path),
        }
    }, [format, now, pictureOf, t, workspaceId])
}
