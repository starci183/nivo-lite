"use client"

import { useTranslations } from "next-intl"
import { useDocsAddress } from "@/hooks/knowledge"
import { useSlotLabels } from "@/hooks/slot"
import {
    docCountsOf,
    docRowOf,
    docsListViewOf,
    docsMatching,
    docsOfAgent,
    nivoMatching,
    nivoRowOf,
} from "@/modules/documents"
import type { DataSlot, DocListView, DocTabId, DocsSelection, KnowledgeDocument, NivoEntry } from "@/modules/types"
import type { KnowledgeRowOfView } from "./useKnowledgeRowOf"

/** What the list is made of: the reads it settles from, the open row's reader and the address. */
interface DocsListInput {
    readonly selection: DocsSelection
    readonly row: KnowledgeRowOfView
    readonly sources: {
        readonly sources: ReadonlyArray<KnowledgeDocument> | undefined
        readonly slot: DataSlot<KnowledgeDocument[]>
    }
    readonly nivo: { readonly items: ReadonlyArray<NivoEntry> | undefined; readonly slot: DataSlot<NivoEntry[]> }
}

/** The list pane and what it implies for the rest of the screen: the filter in force and the item of the base knowledge in view. */
export interface DocsListView {
    readonly list: DocListView
    readonly tab: DocTabId
    /** The item of the base knowledge in view: the one the address names, else the first. */
    readonly chosen: NivoEntry | undefined
    readonly selectedId: string | null
}

/** The list pane: the documents of the agent (or the base knowledge) narrowed by the filter and the search text, with the tab counts. */
export const useDocsList = (input: DocsListInput): DocsListView => {
    const t = useTranslations("knowledge")
    const labels = useSlotLabels()
    const address = useDocsAddress()
    const { selection, row } = input
    const tab: DocTabId = selection.kind === "nivo" ? "nivo" : address.tab
    const ofAgent = docsOfAgent(input.sources.sources ?? [], address.module)
    const nivo = nivoMatching(input.nivo.items ?? [], address.module, address.query)
    const chosen = nivo.find((item) => item.id === address.item) ?? nivo[0]
    const selectedId = selection.kind === "doc" ? (selection.id ?? null) : (chosen?.id ?? null)
    const list = docsListViewOf({
        t,
        tab,
        isMemberLoading: row.member.isLoading,
        sources: input.sources.slot,
        nivo: input.nivo.slot,
        rows: {
            documents: docsMatching(ofAgent, tab, address.query).map((source) => docRowOf(source, row.rowOf(source))),
            nivoRows: nivo.map((item) => nivoRowOf(t, item)),
            counts: { ...docCountsOf(ofAgent), nivo: input.nivo.items === undefined ? undefined : nivo.length },
            isFiltered: address.query.trim() !== "" || address.module !== "all" || tab === "active" || tab === "failed",
        },
        selectedId: selection.kind === "none" ? null : selectedId,
        query: address.query,
        module: address.module,
        labels,
    })
    return { list, tab, chosen, selectedId }
}
