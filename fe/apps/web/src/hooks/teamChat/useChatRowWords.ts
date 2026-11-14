"use client"

import { useFormatter, useLocale, useNow, useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { useInstallations } from "@/hooks/installations"
import { useWorkspaceId } from "@/hooks/workspaces"
import { workspaceHref } from "@/modules/routes"
import { messagesCopyOf } from "./teamChat.copy"
import { stopCardWordsOf, type ChatRowWords, type TeamChatWords } from "./teamChat.shared"
import { stopPreviewNodeOf, type BackgroundStoppedWords } from "@/modules/teamChat"
import { useBrainChangeWords } from "./useBrainChangeWords"

/** The title of a stopped work: it names the work, and for the documents' truths whether the shop is full. */
const stoppedTitleOf = (t: TeamChatWords, work: string, reason: string): string => {
    if (work === "brain.policies.derive") return t("backgroundStopped.title")
    if (work === "brain.vectors.sync") return t("backgroundStopped.titleVectors")
    if (work !== "brain.documents.truths") return t("backgroundStopped.titleGeneric")
    return reason === "ceiling" ? t("backgroundStopped.titleCeiling") : t("backgroundStopped.titleTruths")
}

/** What a work is called in the muted line of its card. */
const stoppedWorkOf = (t: TeamChatWords, work: string): string => {
    if (work === "brain.policies.derive") return t("backgroundStopped.work.brain.policies.derive")
    if (work === "brain.documents.truths") return t("backgroundStopped.work.brain.documents.truths")
    return work === "brain.vectors.sync" ? t("backgroundStopped.work.brain.vectors.sync") : t("backgroundStopped.work.generic")
}

/** The sentence of each pair of work and reason; the pairs the back end can send today. */
const STOPPED_MESSAGES: Readonly<Record<string, (t: TeamChatWords) => string>> = {
    "brain.policies.derive:model": (t) => t("backgroundStopped.message.policies.model"),
    "brain.policies.derive:gave_up": (t) => t("backgroundStopped.message.policies.gave_up"),
    "brain.policies.derive:credits": (t) => t("backgroundStopped.message.policies.credits"),
    "brain.documents.truths:credits": (t) => t("backgroundStopped.message.documents.credits"),
    "brain.documents.truths:model": (t) => t("backgroundStopped.message.documents.model"),
    "brain.documents.truths:gave_up": (t) => t("backgroundStopped.message.documents.gave_up"),
    "brain.documents.truths:ceiling": (t) => t("backgroundStopped.message.documents.ceiling"),
    "brain.vectors.sync:gave_up": (t) => t("backgroundStopped.message.vectors.gave_up"),
}

/** The sentence for why a work stopped; the generic sentence for a work or reason the web does not know. */
const stoppedMessageOf = (t: TeamChatWords, work: string, reason: string): string =>
    (STOPPED_MESSAGES[`${work}:${reason}`] ?? ((words: TeamChatWords) => words("backgroundStopped.message.generic")))(t)

/** The words of the way out of a card, by the kind of place it leads to. */
const stoppedActionOf = (t: TeamChatWords, kind: string): string | null => {
    if (kind === "brain.policies") return t("backgroundStopped.action.brain.policies")
    return kind === "brain.documents" ? t("backgroundStopped.action.brain.documents") : null
}

/** The words of the "background work stopped" cards: every code the back end sends is a key of the web; an unknown code reads generically. */
const backgroundStoppedWordsOf = (
    t: TeamChatWords,
    clocks: Pick<BackgroundStoppedWords, "timeOf" | "sinceOf" | "hrefOf">,
): BackgroundStoppedWords => ({
    nivoName: t("nivoRoom.name"),
    chip: t("backgroundStopped.chip"),
    titleOf: (work, reason) => stoppedTitleOf(t, work, reason),
    detailsLabel: t("backgroundStopped.details"),
    factsLabel: t("backgroundStopped.factsLabel"),
    factWork: t("backgroundStopped.factWork"),
    factReason: t("backgroundStopped.factReason"),
    factSince: t("backgroundStopped.factSince"),
    workOf: (work) => stoppedWorkOf(t, work),
    messageOf: (work, reason) => stoppedMessageOf(t, work, reason),
    actionOf: (kind) => stoppedActionOf(t, kind),
    ...clocks,
})

/** The shop's own time: a plan's start day is the day on the shop's wall, not the viewer's. */
const SHOP_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The clock of a moment: hours and minutes, 24-hour. */
const CLOCK_FORMAT = { hour: "2-digit", minute: "2-digit", hour12: false } as const

/** How often the clock of the rows is read again (milliseconds). */
const CLOCK_REFRESH_MS = 60_000

/** The clocks and words a room row or a message row needs, in the viewer's language. */
export const useChatRowWords = (): ChatRowWords => {
    const t = useTranslations("teamChat")
    const locale = useLocale()
    const format = useFormatter()
    const now = useNow({ updateInterval: CLOCK_REFRESH_MS })
    const { installations } = useInstallations()
    const workspaceId = useWorkspaceId()
    const pictureOf = useCallback(
        (name: string): string | null =>
            installations?.find((installation) => installation.name === name)?.agentAvatarUrl ?? null,
        [installations],
    )
    const clocks = useMemo(() => {
        const dayOf = (iso: string, timeZone?: string): string => {
            const at = new Date(iso)
            const zone = timeZone === undefined ? {} : { timeZone }
            return `${format.dateTime(at, { day: "2-digit", ...zone })}/${format.dateTime(at, { month: "2-digit", ...zone })}`
        }
        const timeOf = (iso: string): string => format.dateTime(new Date(iso), CLOCK_FORMAT)
        return {
            timeOf,
            dateTimeOf: (iso: string): string => `${dayOf(iso)} ${timeOf(iso)}`,
            shopDateOf: (iso: string): string => dayOf(iso, SHOP_TIME_ZONE),
        }
    }, [format])
    const brainChange = useBrainChangeWords(clocks)
    return useMemo(() => {
        const { timeOf } = clocks
        const hrefOf = (path: string): string => workspaceHref(workspaceId, path)
        const copy = messagesCopyOf(t, locale)
        const sinceOf = (iso: string): string => {
            const at = new Date(iso)
            const day = format.dateTime(at, { day: "2-digit" })
            return `${timeOf(iso)} ${day}/${format.dateTime(at, { month: "2-digit" })}`
        }
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
            copy,
            stop: stopCardWordsOf(t, timeOf, (preview, stop) => stopPreviewNodeOf(preview, stop, copy)),
            backgroundStopped: backgroundStoppedWordsOf(t, { timeOf, sinceOf, hrefOf }),
            brainChange,
            hrefOf,
        }
    }, [brainChange, clocks, format, locale, now, pictureOf, t, workspaceId])
}
