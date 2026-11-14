"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useKnowledgeSources, useWorkspaceMember } from "@/hooks/knowledge"
import { factKeysOf, needsMaintenance, type FactKey, type PickGrouping } from "@/modules/brain"
import { slotOfReads } from "@/hooks/slot"
import type { DataSlot, FactDrawerView, FactPickCopy, FactPickGroupView, FactsPagingView } from "@/modules/types"
import {
    FACT_STATUS_FILTERS,
    FACTS_PAGE_SIZE,
    isIn,
    serverStatusesOf,
    shownKeysOf,
    type FactStatusFilter,
} from "@/modules/documents"
import { useBrain } from "./useBrain"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainCommand } from "./useBrainCommand"
import { useBrainFactMap, type FactMapState } from "./useBrainFactMap"
import { useFactDrawer } from "./useFactDrawer"
import { useFactDrawers, type FactDrawers } from "./useFactDrawers"
import { useFactPick, type FactPick } from "./useFactPick"
import { useFactsPage } from "./useFactsPage"
import { useFactsPageWords, type FactsPageWords } from "./useFactsPageWords"
import { useFactWords } from "./useFactWords"
import { useFailureToast } from "./useFailureToast"

/** What the address asks of the facts page: the fact drawer it may open. */
interface BrainFactsInput {
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/** The command that brings the brain up to date when a value started or ended; null when nothing is due. */
type MaintainView = { readonly title: string; readonly body: string; readonly actionLabel: string } | null

/** What the facts page gives its block. */
export interface BrainFactsPage extends FactDrawers {
    /** The groups of facts as the brain read settled. */
    readonly slot: DataSlot<ReadonlyArray<FactPickGroupView>>
    readonly copy: FactPickCopy
    readonly count: number
    readonly filters: {
        readonly status: ReadonlyArray<{
            readonly id: FactStatusFilter
            readonly label: string
            readonly count: number
        }>
        readonly selected: FactStatusFilter
        readonly query: string
        readonly grouping: PickGrouping
    }
    readonly canWrite: boolean
    readonly maintain: MaintainView
    readonly pick: FactPick
    /** The paging of the list: the page shown, how many are reachable, the total and the span; null when everything fits one page. */
    readonly paging: FactsPagingView | null
    /** The words of the pager under the list. */
    readonly pager: FactsPageWords
    readonly drawer: FactDrawerView | null
    /** The map of the same facts: the card's way of drawing them, the audience views and the side pane. */
    readonly map: FactMapState
    readonly on: {
        readonly setStatus: (id: string) => void
        readonly setQuery: (value: string) => void
        readonly setGrouping: (id: string) => void
        readonly retry: () => void
        readonly setPage: (page: number) => void
        readonly maintain: () => void
    }
}

/** The words of the facts table: an empty page and a filter that keeps nothing say different things. */
const useFactsCopy = (isFiltered: boolean): FactPickCopy => {
    const t = useTranslations("brainInbox")
    const f = useTranslations("brainFacts")
    return {
        label: t("factsTable"),
        columns: { item: t("colItem"), value: t("colValue"), badge: t("colTrust"), action: t("colAction") },
        openLabel: t("openFact"),
        compareLabel: t("compare"),
        emptyTitle: isFiltered ? t("factsNoMatchTitle") : f("emptyTitle"),
        emptyBody: isFiltered ? t("factsNoMatchBody") : f("emptyBody"),
    }
}

/** The states with their words and how many keys each keeps. */
const useStatusTabs = (keys: ReadonlyArray<FactKey>): BrainFactsPage["filters"]["status"] => {
    const t = useTranslations("brainInbox")
    const label: Readonly<Record<FactStatusFilter, string>> = {
        all: t("filterAll"),
        waiting: t("filterWaiting"),
        active: t("filterActive"),
        conflict: t("filterConflict"),
        retired: t("filterRetired"),
    }
    return FACT_STATUS_FILTERS.map((id) => ({
        id,
        label: label[id],
        count: keys.filter((one) => isIn(one, id)).length,
    }))
}

/**
 * The facts of the Second Brain grouped by subject (or by document), the waiting ones with the ones in use, each group with its tick:
 * one row per subject and attribute, the way the inbox and the rail count them. A row opens its detail; a conflict opens the comparison.
 */
export const useBrainFacts = (input: BrainFactsInput): BrainFactsPage => {
    const brain = useTranslations("brain")
    const board = useBrainBoard()
    const command = useBrainCommand()
    const failed = useFailureToast()
    const words = useFactWords()
    const sources = useKnowledgeSources().sources
    const [status, setStatus] = useState<FactStatusFilter>("all")
    const [query, setQuery] = useState("")
    const [grouping, setGrouping] = useState<PickGrouping>("subject")
    const brainRead = useBrain()
    const keys = factKeysOf(board.facts)
    const needle = query.trim().toLowerCase()
    const isServerList = status !== "conflict"
    const paged = useFactsPage({ statuses: serverStatusesOf(status), search: query, enabled: isServerList })
    const shown = shownKeysOf({ filter: status, query, keys, page: paged.facts })
    const topicOf = (sourceId: string) => sources?.find((source) => source.id === sourceId)?.topic ?? undefined
    const pick = useFactPick({ keys: shown, by: grouping, topicOf, words: words.pick, canWrite: board.canWrite })
    const drawers = useFactDrawers({ tab: "facts", board, keys, words: words.drawer })
    const drawer = useFactDrawer({ tab: "facts", fact: input.fact, edit: input.edit, answer: input.answer })
    const member = useWorkspaceMember()
    const map = useBrainFactMap({
        board,
        keys,
        workspaceName: member.workspaceName,
        words: words.drawer,
        compare: drawers.conflict.on.open,
    })
    const copy = useFactsCopy(status !== "all" || needle !== "")
    const statusTabs = useStatusTabs(keys)
    const paging: FactsPagingView | null =
        isServerList && paged.total > FACTS_PAGE_SIZE
            ? {
                  page: paged.page,
                  pageCount: paged.pageCount,
                  total: paged.total,
                  from: paged.span.from,
                  to: paged.span.to,
              }
            : null
    const pager = useFactsPageWords(paging)
    const isDue = board.canWrite && needsMaintenance(board.facts, board.nowMs)
    return {
        ...drawers,
        slot: slotOfReads(
            [
                { data: brainRead.brain, error: brainRead.error, isLoading: brainRead.isLoading },
                ...(isServerList ? [paged.read] : []),
            ],
            () => pick.groups,
        ),
        copy,
        count: isServerList && needle !== "" ? paged.total : (statusTabs.find((one) => one.id === status)?.count ?? 0),
        filters: { status: statusTabs, selected: status, query, grouping },
        canWrite: board.canWrite,
        maintain: isDue
            ? { title: brain("maintainTitle"), body: brain("maintainBody"), actionLabel: brain("maintainAction") }
            : null,
        pick,
        paging,
        pager,
        drawer,
        map,
        on: {
            setStatus: (id) => setStatus(FACT_STATUS_FILTERS.find((one) => one === id) ?? status),
            setQuery,
            setGrouping: (id) => setGrouping(id === "document" ? "document" : "subject"),
            retry: () => {
                board.reload()
                paged.reload()
            },
            setPage: paged.go,
            maintain: () => {
                command.send("brain.maintain", undefined).catch(failed)
            },
        },
    }
}
