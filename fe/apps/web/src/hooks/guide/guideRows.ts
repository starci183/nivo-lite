import type { IconName } from "@/components/leaves/Icon"
import type { GuideDoc, GuideGroup, GuideKind } from "@/modules/guide"

/** The mark of each kind of result. */
export const KIND_ICONS: Readonly<Record<GuideKind, IconName>> = {
    route: "explore",
    tab: "view",
    action: "add",
    guide: "course",
    agent: "agentos",
    connection: "servers",
    lead: "profile",
    order: "cart",
    document: "document",
    fact: "brain",
}

/** The catalog key of the word that names each kind. */
export const KIND_WORDS: Readonly<Record<GuideKind, string>> = {
    route: "kindRoute",
    tab: "kindTab",
    action: "kindAction",
    guide: "kindGuide",
    agent: "kindAgent",
    connection: "kindConnection",
    lead: "kindLead",
    order: "kindOrder",
    document: "kindDocument",
    fact: "kindFact",
}

/** The catalog key of the heading of each group. */
export const GROUP_WORDS: Readonly<Record<GuideGroup, string>> = {
    go: "groupGo",
    do: "groupDo",
    found: "groupFound",
    guide: "groupGuide",
}

/** The page entry whose address is the start of `path` (the longest wins): the title of "you are here". */
export const pageDocAt = (path: string, docs: ReadonlyArray<GuideDoc>): GuideDoc | undefined => {
    const address = path.split(/[?#]/u)[0] ?? path
    const target = address === "/" ? "/overview" : address
    return docs
        .filter((doc) => doc.kind === "route" && (target === doc.href || target.startsWith(`${doc.href}/`)))
        .sort((a, b) => b.href.length - a.href.length)[0]
}
