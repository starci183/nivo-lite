import "server-only"

import { getTranslations } from "next-intl/server"
import { GUIDE_PAGES } from "./sitemap"

/** The words of the guide in one language: the map's text and the fixed lines of its answers. */
export interface GuideText {
    readonly locale: "vi" | "en"
    readonly title: (pageId: string) => string
    readonly what: (pageId: string) => string
    readonly steps: (pageId: string) => ReadonlyArray<string>
    readonly keywords: (pageId: string) => ReadonlyArray<string>
    readonly empty: string
    readonly managerOnly: (title: string) => string
    readonly busy: string
    readonly open: (title: string) => string
    readonly systemLines: (isManager: boolean) => ReadonlyArray<string>
    readonly replyFormat: string
}

const stringsOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

/** Loads the guide's words for a language from the catalogs. */
export const loadGuideText = async (locale: "vi" | "en"): Promise<GuideText> => {
    const [map, copy] = await Promise.all([
        getTranslations({ locale, namespace: "guideMap" }),
        getTranslations({ locale, namespace: "guide" }),
    ])
    const known = new Set(GUIDE_PAGES.map((page) => page.id))
    const rawOf = (pageId: string, key: string): unknown => (known.has(pageId) ? map.raw(`${pageId}.${key}`) : [])
    return {
        locale,
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
}
