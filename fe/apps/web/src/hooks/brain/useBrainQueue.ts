"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSlotLabels } from "@/hooks/slot"
import { usePanePhone } from "@/hooks/paneFrame"
import { brainGridOf } from "@/modules/brain"
import type { FindingDialogValues, TodoFilter } from "@/modules/brain"
import type { DataSlot, QueueEntryView, QueueFilterView, QueueView } from "@/modules/types"
import { useFailureToast } from "./useFailureToast"
import { useQueueEntries } from "./useQueueEntries"

/** What the queue does. */
interface BrainQueueCommands {
    readonly setFilter: (id: string) => void
    readonly setQuery: (value: string) => void
    readonly select: (id: string) => void
    readonly back: () => void
    readonly retry: () => void
    readonly loadMore: () => void
    readonly act: (entryId: string, actionId: string, partId?: string) => void
    readonly submitDialog: (values: FindingDialogValues) => void
    readonly closeDialog: () => void
}

/** What the queue gives its block: the view, what it does, and the dialog a command opened. */
interface BrainQueue {
    readonly view: QueueView
    readonly on: BrainQueueCommands
    readonly dialog: ReturnType<typeof useQueueEntries>["dialog"]["view"]
}

/** The words of a filter besides the kinds of finding. */
const FILTER_KEY = { all: "filterAll", facts: "filterFacts", ask: "filterAsk" } as const

/** Whether a region's slot failed to read. */
const hasFailed = (slot: DataSlot<unknown>): boolean => "isError" in slot || "isForbidden" in slot

/** Whether a region's slot is still on its first read. */
const isWaiting = (slot: DataSlot<unknown>): boolean => "isLoading" in slot

/** The status of the whole queue: waiting while any region is, failed when all are, empty when none has an entry. */
const slotOf = (
    regions: ReadonlyArray<DataSlot<unknown>>,
    entries: ReadonlyArray<QueueEntryView>,
    shown: ReadonlyArray<QueueEntryView>,
): DataSlot<ReadonlyArray<QueueEntryView>> => {
    if (regions.some(isWaiting)) return { isLoading: true }
    if (regions.every(hasFailed)) return { isError: true }
    return entries.length === 0 ? { isEmpty: true } : { items: shown }
}

/**
 * The one queue of what needs the owner: the findings of the dossier review, the facts waiting, the customer questions and the
 * proposed public answers, merged into rows of one list with a search and a filter, and the opened item with its commands. Each
 * region keeps its own read and its own retry; the rows of the regions that did read stay in view when one failed.
 */
export const useBrainQueue = (): BrainQueue => {
    const t = useTranslations("dossierReview")
    const q = useTranslations("brainQueue")
    const failed = useFailureToast()
    const slotLabels = useSlotLabels()
    const data = useQueueEntries()
    const phone = usePanePhone()
    const [picked, setPicked] = useState<TodoFilter>("all")
    const [query, setQuery] = useState("")
    const [chosen, setChosen] = useState<string | null>(null)
    const filter = data.filters.some((one) => one.id === picked) ? picked : "all"
    const needle = query.trim().toLowerCase()
    const shown = data.entries
        .filter((entry) => filter === "all" || entry.filter === filter)
        .filter((entry) => needle === "" || `${entry.title} ${entry.line}`.toLowerCase().includes(needle))
    const waiting = data.regions.some(isWaiting)
    const selected = shown.find((entry) => entry.id === chosen) ?? (phone.phone === "main" ? null : (shown[0] ?? null))
    const labelOf = (id: TodoFilter): string =>
        t(id === "all" || id === "facts" || id === "ask" ? FILTER_KEY[id] : `kind_${id}`)
    const filters: ReadonlyArray<QueueFilterView> = waiting
        ? (["all", "contradiction", "facts"] as const).map((id) => ({ id, label: labelOf(id) }))
        : data.filters.map((one) => ({
              id: one.id,
              label: labelOf(one.id),
              count: one.count,
          }))
    const slot = slotOf(data.regions, data.entries, shown)
    const view: QueueView = {
        slot,
        isFiltered: data.entries.length > 0 && shown.length === 0,
        slotLabels: { ...slotLabels(q("emptyTitle")), error: q("errorTitle") },
        filters,
        filter,
        query,
        selectedId: selected?.id ?? null,
        grid: brainGridOf({ hasAside: true, phone: phone.phone, isWhole: !("items" in slot) && !waiting }),
        partialFailure: data.regions.some(hasFailed) && !data.regions.every(hasFailed) ? q("partialFailure") : null,
        hasNextPage: data.paging.hasNextPage,
    }
    const on: BrainQueueCommands = {
        setFilter: (id) => setPicked(data.filters.find((one) => one.id === id)?.id ?? filter),
        setQuery,
        select: (id) => {
            setChosen(id)
            phone.showMain()
        },
        back: phone.showList,
        retry: data.retry,
        loadMore: data.paging.loadMore,
        act: (entryId, actionId, partId) => {
            const entry = data.entries.find((one) => one.id === entryId)
            if (entry !== undefined) data.act(entry, actionId, partId)
        },
        submitDialog: (values) => {
            data.dialog.submit(values).catch(() => {
                failed()
            })
        },
        closeDialog: data.dialog.close,
    }
    return { view, on, dialog: data.dialog.view }
}
