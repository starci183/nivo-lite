import type { DocumentRowView } from "./document-row"
import type { KnowledgeTranslate } from "./docs-translate"
import type {
    KnowledgeDocument,
    NivoEntry,
    DocChipView,
    DocGlyph,
    DocRowView,
    DocTabId,
    DocTabView,
} from "@/modules/types"
import { isDocumentActive } from "./status"

/** The filters of the list, in the order they are drawn; the selected one always stays visible, the rest fold into "+n". */
const DOC_TAB_IDS: ReadonlyArray<DocTabId> = ["all", "active", "failed", "nivo"]

/** The filter an address asks for: the base knowledge is a place of its own (its address), so only the filters of documents count; anything unknown is every document. */
export const docTabOf = (value: string | null | undefined): DocTabId =>
    DOC_TAB_IDS.find((id) => id !== "nivo" && id === value) ?? "all"

/** The mark of each kind of document. */
const GLYPH_OF_KIND: Readonly<Record<KnowledgeDocument["kind"], DocGlyph>> = {
    text: "text",
    faq: "faq",
    file: "file",
    url: "url",
}

/** The glyph of a document. */
export const docGlyphOf = (source: Pick<KnowledgeDocument, "kind">): DocGlyph => GLYPH_OF_KIND[source.kind]

/** Whether a worker has given up on a document: it failed or waits for credit. */
const isDocumentFailed = (source: Pick<KnowledgeDocument, "status">): boolean =>
    source.status === "failed" || source.status === "blocked_credits"

/** Whether a document belongs to a filter of the documents (the base knowledge is not a document). */
const isInTab = (source: KnowledgeDocument, tab: DocTabId): boolean => {
    if (tab === "active") return isDocumentActive(source.status)
    if (tab === "failed") return isDocumentFailed(source)
    return tab === "all"
}

/** The documents of the agent chosen, then of the filter chosen; "all" agents keeps every one. */
export const docsOfAgent = (
    sources: ReadonlyArray<KnowledgeDocument>,
    module: string,
): ReadonlyArray<KnowledgeDocument> =>
    module === "all" ? sources : sources.filter((source) => source.module === module)

/** How many documents each filter holds, over the documents of the chosen agent. */
export const docCountsOf = (sources: ReadonlyArray<KnowledgeDocument>): Readonly<Record<DocTabId, number>> => ({
    all: sources.length,
    active: sources.filter((source) => isInTab(source, "active")).length,
    failed: sources.filter((source) => isInTab(source, "failed")).length,
    nivo: 0,
})

/** The documents a search text matches, by name, topic or tag; an empty text keeps every one. */
export const docsMatching = (
    sources: ReadonlyArray<KnowledgeDocument>,
    tab: DocTabId,
    query: string,
): ReadonlyArray<KnowledgeDocument> => {
    const needle = query.trim().toLowerCase()
    return sources.filter(
        (source) =>
            isInTab(source, tab) &&
            (needle === "" ||
                [source.title, source.topic ?? "", ...source.tags].some((text) => text.toLowerCase().includes(needle))),
    )
}

/** The base knowledge a search text matches, by title or text, for the agent chosen. */
export const nivoMatching = (
    items: ReadonlyArray<NivoEntry>,
    module: string,
    query: string,
): ReadonlyArray<NivoEntry> => {
    const needle = query.trim().toLowerCase()
    return items.filter(
        (item) =>
            (module === "all" || item.module === module) &&
            (needle === "" || `${item.title} ${item.body}`.toLowerCase().includes(needle)),
    )
}

/** The chip of a row: where the document stands; while a worker is on it the percent follows the words. */
export const docChipOf = (row: DocumentRowView): DocChipView | null => {
    const first = row.badges[0]
    if (first === undefined) return null
    return row.progress === undefined
        ? first
        : { label: `${first.label} ${Math.round(row.progress.value)}%`, tone: first.tone }
}

/** One row of the list for a document. */
export const docRowOf = (source: KnowledgeDocument, row: DocumentRowView): DocRowView => ({
    id: source.id,
    title: source.title,
    line: row.lines[0] ?? "",
    glyph: docGlyphOf(source),
    chip: docChipOf(row),
})

/** The first line of a text, for the one line under the name of a row. */
const firstLineOf = (text: string): string => text.split(/\r?\n/u).find((line) => line.trim() !== "") ?? ""

/** One row of the list for an item of the base knowledge: its version and the start of its text; its kind at the end. */
export const nivoRowOf = (t: KnowledgeTranslate, item: NivoEntry): DocRowView => ({
    id: item.id,
    title: item.title,
    line: `${t("nivoVersion", { version: item.version })} · ${firstLineOf(item.body)}`,
    glyph: "nivo",
    chip: { label: t(`nivoKind_${item.kind}`), tone: "neutral" },
})

/** The tabs of the filter row with their counts; the count of a figure that is still being read stays out. */
export const docTabsOf = (
    t: KnowledgeTranslate,
    counts: Readonly<Record<DocTabId, number | undefined>>,
): ReadonlyArray<DocTabView> => [
    { id: "all", label: t("tabAll"), count: counts.all },
    { id: "active", label: t("tabActive"), count: counts.active },
    { id: "failed", label: t("tabFailed"), count: counts.failed },
    { id: "nivo", label: t("tabNivo"), count: counts.nivo },
]
