"use client"

import { useTranslations } from "next-intl"
import type { CritiqueNoticeWords, CritiquePlaceholderWords, CritiqueWords } from "@/modules/brain"
import type { CritiqueCopy } from "@/modules/types"

/** Every word the document critic's blocks draw, resolved once from the `brainCritique` catalogue. */
interface CritiqueCatalog {
    readonly words: CritiqueWords
    readonly notice: CritiqueNoticeWords
    readonly placeholder: CritiquePlaceholderWords
    readonly copy: CritiqueCopy
    readonly headLine: (title: string, count: number) => string
}

/** The words of the points: group and kind names, the comparison terms, the notice, the buttons and the skeleton's sample point. */
export const useCritiqueWords = (): CritiqueCatalog => {
    const t = useTranslations("brainCritique")
    return {
        words: {
            group: (key) => (t.has(`group.${key}`) ? t(`group.${key}`) : t("group.other")),
            kind: (key) => (t.has(`kind.${key}`) ? t(`kind.${key}`) : null),
            inForce: t("compare.inForce"),
            waiting: t("compare.waiting"),
            otherDocument: t("compare.otherDocument"),
            documentSays: t("compare.documentSays"),
        },
        notice: {
            reading: { title: t("notice.readingTitle"), body: t("notice.readingBody") },
            failed: (reason) => ({
                title: t("notice.failedTitle"),
                body:
                    reason !== null && t.has(`notice.reason.${reason}`)
                        ? t(`notice.reason.${reason}`)
                        : t("notice.reason.other"),
            }),
            retry: t("notice.retry"),
        },
        placeholder: {
            group: t("placeholder.group"),
            title: t("placeholder.title"),
            quote: t("placeholder.quote"),
            why: t("placeholder.why"),
            question: t("placeholder.question"),
            choices: [t("placeholder.choiceA"), t("placeholder.choiceB")],
        },
        copy: {
            listLabel: t("listLabel"),
            skip: t("skip"),
            send: t("send"),
            cancel: t("cancel"),
            compareLabel: t("compareLabel"),
            emptyBody: t("emptyBody"),
            errorBody: t("errorBody"),
        },
        headLine: (title, count) => t("headLine", { title, count }),
    }
}
