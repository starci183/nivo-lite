import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { GUIDE_PAGES } from "@/modules/guide"
import type { GuideText } from "@/modules/guide"

const stringsOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

/** The guide's words in the reader's language, from the `guideMap` and `guide` catalogs. */
export const useGuideText = (): GuideText => {
    const map = useTranslations("guideMap")
    const copy = useTranslations("guide")
    return useMemo<GuideText>(() => {
        const known = new Set(GUIDE_PAGES.map((page) => page.id))
        const rawOf = (pageId: string, key: string): unknown => (known.has(pageId) ? map.raw(`${pageId}.${key}`) : [])
        return {
            title: (pageId) => map(`${pageId}.title`),
            what: (pageId) => map(`${pageId}.what`),
            steps: (pageId) => stringsOf(rawOf(pageId, "steps")),
            keywords: (pageId) => stringsOf(rawOf(pageId, "keywords")),
            empty: copy("coreEmpty"),
            managerOnly: (title) => copy("coreManagerOnly", { title }),
            busy: copy("coreBusy"),
            open: (title) => copy("coreOpen", { title }),
            systemLines: (isManager) => [
                copy("coreSystemIntro"),
                copy("coreSystemStyle"),
                copy("coreRulesTitle"),
                ...stringsOf(map.raw("rules")).map((line) => `- ${line}`),
                `- ${copy(isManager ? "coreAudienceManager" : "coreAudienceStaff")}`,
            ],
            replyFormat: copy("coreReplyFormat"),
        }
    }, [map, copy])
}
