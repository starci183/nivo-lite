import type { KeyboardEvent } from "react"
import type { IconName } from "@/components/leaves/Icon"
import type {
    useQueryBrainSwr,
    useQueryConnectionsSwr,
    useQueryKnowledgeSourcesSwr,
    useQueryModuleInstallationsSwr,
} from "@/hooks/swr"
import type { GuideDoc, GuideGroup, GuideKind } from "@/modules/guide"
import { brainTabHref, knowledgeSourceHref } from "@/modules/routes"

/** The strings of a catalog value that holds a list; anything else is none. */
export const stringsOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

/** What the drawer read, each part undefined until its read answers. */
interface GuideReads {
    readonly installations: Exclude<ReturnType<typeof useQueryModuleInstallationsSwr>["data"], undefined> | undefined
    readonly connections: Exclude<ReturnType<typeof useQueryConnectionsSwr>["data"], undefined> | undefined
    readonly brain: Exclude<ReturnType<typeof useQueryBrainSwr>["data"], undefined> | undefined
    readonly documents: Exclude<ReturnType<typeof useQueryKnowledgeSourcesSwr>["data"], undefined> | undefined
}

/** The most facts and documents the index holds. */
const BULK_LIMIT = 200

/** The pages that open one connection; any other provider opens the generic connection page. */
const CONNECTION_PAGES: Readonly<Record<string, string>> = { sepay: "sepay", telegram: "telegram", zalo_oa: "zalo" }

/** The page of one connection. */
export const connectionHref = (provider: string, id: string): string =>
    `/connections/${CONNECTION_PAGES[provider] ?? "open"}/${encodeURIComponent(id)}`

/** The workspace's own things as searchable documents. Their words are the workspace's data, not catalog words. */
export const docsOfData = (reads: GuideReads): ReadonlyArray<GuideDoc> => [
    ...(reads.installations ?? []).map(
        (one): GuideDoc => ({
            id: `agent-${one.id}`,
            group: "found",
            kind: "agent",
            title: one.agentName,
            hint: one.name,
            keywords: [one.agentHandle, one.moduleKey],
            href: `/agents/${one.moduleKey}/${one.id}`,
        }),
    ),
    ...(reads.connections ?? []).map(
        (one): GuideDoc => ({
            id: `connection-${one.id}`,
            group: "found",
            kind: "connection",
            title: one.name,
            hint: one.provider,
            keywords: [one.provider],
            href: connectionHref(one.provider, one.id),
        }),
    ),
    ...(reads.documents ?? []).slice(0, BULK_LIMIT).map(
        (one): GuideDoc => ({
            id: `document-${one.id}`,
            group: "found",
            kind: "document",
            title: one.title,
            hint: one.topic ?? "",
            keywords: one.tags,
            href: knowledgeSourceHref(one.id),
        }),
    ),
    ...(reads.brain?.facts ?? []).slice(0, BULK_LIMIT).map(
        (one): GuideDoc => ({
            id: `fact-${one.id}`,
            group: "found",
            kind: "fact",
            title: `${one.subjectLabel} - ${one.attributeLabel}`,
            hint: one.value,
            keywords: [],
            href: brainTabHref("facts"),
        }),
    ),
]

/** The mark of each kind of result. */
export const KIND_ICONS: Readonly<Record<GuideKind, IconName>> = {
    route: "explore",
    tab: "view",
    action: "add",
    guide: "course",
    agent: "agentos",
    connection: "servers",
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

const PRESS = '[data-grammar-row-press="true"]'
const FIELD = "input"
const SHEET = '[role="dialog"]'

/**
 * Arrow keys through the results: Down from the field goes to the first result, Down and Up step between results, Up from the first
 * returns to the field. The results are Grammar rows whose title is the one focusable press target, so Enter or Space on a focused
 * result opens it with the platform's own behaviour and the focus ring is Grammar's. Put `onKeyDown` on the result list and on the
 * field's band; the drawer sheet around them is the scope.
 */
export const onGuideKeys = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    const sheet = event.currentTarget.closest<HTMLElement>(SHEET)
    if (sheet === null) return
    const rows = Array.from(sheet.querySelectorAll<HTMLElement>(PRESS))
    const active = document.activeElement
    const at = active instanceof HTMLElement ? rows.indexOf(active) : -1
    if (at === -1 && event.key === "ArrowUp") return
    event.preventDefault()
    const next = event.key === "ArrowDown" ? at + 1 : at - 1
    if (next < 0) sheet.querySelector<HTMLElement>(FIELD)?.focus()
    else rows[Math.min(next, rows.length - 1)]?.focus()
}
