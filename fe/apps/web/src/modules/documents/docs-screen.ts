import type { useTranslations } from "next-intl"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import { docTabsOf } from "./docs-rows"
import { AGENT_MODULES } from "./status"
import type { KnowledgeTranslate } from "./docs-translate"
import type {
    BrainPageHeading,
    DataSlot,
    KnowledgeDocument,
    NivoEntry,
    SlotLabels,
    DocBodyView,
    DocListView,
    DocMainView,
    DocOpenedView,
    DocRowView,
    DocTabId,
    DocsCopy,
    DocsSelection,
    NivoBodyView,
} from "@/modules/types"

/** The tail of an address from the keys that are set. */
export const docsTailOf = (params: Readonly<Record<string, string | undefined>>): string => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.set(key, value)
    })
    const rest = query.toString()
    return rest === "" ? "" : `?${rest}`
}

/** The words of the panes that belong to no data. */
export const docsCopyOf = (t: KnowledgeTranslate, tp: ReturnType<typeof useTranslations<"pane">>): DocsCopy => ({
    grid: t("docsGrid"),
    listLabel: t("listTitle"),
    searchLabel: t("docsSearch"),
    searchPlaceholder: t("docsSearch"),
    clearSearch: tp("clearSearch"),
    tabsLabel: t("docsFilterLabel"),
    moduleLabel: t("docsForLabel"),
    modulePlaceholder: t("selectPlaceholder"),
    moreFilters: (count: number) => tp("moreFilters", { count }),
    back: tp("backToList"),
    moreActions: tp("moreActions"),
    asideTitle: t("asideTitle"),
    closeAside: t("asideClose"),
    pickTitle: t("docsPickTitle"),
    pickBody: t("docsPickBody"),
    noMatchTitle: tp("noMatchTitle"),
    noMatchBody: tp("noMatchBody"),
    clearFilters: tp("clearFilters"),
    emptyBody: t("docsEmptyBody"),
    emptyAction: t("addTitle"),
    errorBody: tp("errorBody"),
})

/** The name of the open item for the trail: the base knowledge has one name, a document its title. */
const tailLabelOf = (t: KnowledgeTranslate, selection: DocsSelection, itemTitle: string | undefined): string => {
    if (selection.kind === "nivo") return t("nivoLink")
    return itemTitle ?? t("title")
}

/** The trail of the page: where the console starts, the Second Brain, and while an item is open the documents and its name. */
export const docsTrailOf = (
    heading: BrainPageHeading,
    t: KnowledgeTranslate,
    selection: DocsSelection,
    itemTitle: string | undefined,
): BrainPageHeading => {
    const [home, brain] = heading.breadcrumbs.items
    const open =
        selection.kind === "none"
            ? []
            : [
                  { id: "documents", label: t("title"), href: KNOWLEDGE_ROUTES.library },
                  { id: "item", label: tailLabelOf(t, selection, itemTitle) },
              ]
    return {
        ...heading,
        breadcrumbs: {
            ...heading.breadcrumbs,
            items: [
                ...(home === undefined ? [] : [home]),
                ...(brain === undefined ? [] : [{ ...brain, href: KNOWLEDGE_ROUTES.brain }]),
                ...open,
            ],
        },
    }
}

/** The middle pane's view for what the address opens. */
export const docsMainViewOf = (
    selection: DocsSelection,
    doc: DataSlot<DocOpenedView<DocBodyView>>,
    nivo: DataSlot<DocOpenedView<NivoBodyView>>,
): DocMainView => {
    if (selection.kind === "none") return { kind: "none" }
    return selection.kind === "doc" ? { kind: "doc", slot: doc } : { kind: "nivo", slot: nivo }
}

/** The opened item of the base knowledge as a slot: nothing to open is an empty slot. */
export const docsNivoSlotOf = (
    nivo: DataSlot<ReadonlyArray<unknown>>,
    opened: DocOpenedView<NivoBodyView> | undefined,
): DataSlot<DocOpenedView<NivoBodyView>> => {
    if (!("items" in nivo)) return nivo
    return opened === undefined ? { isEmpty: true } : { items: opened }
}

/** What the list view is made of. */
interface ListViewInput {
    readonly t: KnowledgeTranslate
    readonly tab: DocTabId
    readonly isMemberLoading: boolean
    readonly sources: DataSlot<ReadonlyArray<KnowledgeDocument>>
    readonly nivo: DataSlot<ReadonlyArray<NivoEntry>>
    readonly rows: {
        readonly documents: ReadonlyArray<DocRowView>
        readonly nivoRows: ReadonlyArray<DocRowView>
        readonly counts: Readonly<Record<DocTabId, number | undefined>>
        readonly isFiltered: boolean
    }
    readonly selectedId: string | null
    readonly query: string
    readonly module: string
    readonly labels: (empty: string) => SlotLabels
}

/** The slot of the rows: settled the way the read settled; a filter that matched nothing is an empty list, not an empty library. */
const rowsSlotOf = (input: ListViewInput): DataSlot<ReadonlyArray<DocRowView>> => {
    if (input.isMemberLoading) return { isLoading: true }
    const settled = input.tab === "nivo" ? input.nivo : input.sources
    if (!("items" in settled)) return settled
    return { items: input.tab === "nivo" ? input.rows.nivoRows : input.rows.documents }
}

/** The list pane's view: the rows of the filter, the tabs with their counts, the agent choices and the open row. */
export const docsListViewOf = (input: ListViewInput): DocListView => ({
    slot: rowsSlotOf(input),
    slotLabels: input.labels(input.t(input.tab === "nivo" ? "nivoEmpty" : "emptyTitle")),
    query: input.query,
    tab: input.tab,
    tabs: docTabsOf(input.t, input.rows.counts),
    module: input.module,
    moduleOptions: [
        { id: "all", label: input.t("moduleAll") },
        ...AGENT_MODULES.map((key) => ({ id: key, label: input.t(`module_${key}`) })),
    ],
    selectedId: input.selectedId,
    isFiltered: input.rows.isFiltered,
})
