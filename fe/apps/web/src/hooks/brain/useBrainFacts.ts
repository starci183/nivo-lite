"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useKnowledgeSources, useWorkspaceMember } from "@/hooks/knowledge"
import { factKeysOf, needsMaintenance } from "@/modules/brain"
import type { FactKey, PickGrouping } from "@/modules/brain"
import { mapSlot } from "@/hooks/slot"
import type { DataSlot, FactDrawerView, FactPickCopy, FactPickGroupView } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainCommand } from "./useBrainCommand"
import { useBrainFactMap } from "./useBrainFactMap"
import type { FactMapState } from "./useBrainFactMap"
import { useFactDrawer } from "./useFactDrawer"
import { useFactDrawers } from "./useFactDrawers"
import type { FactDrawers } from "./useFactDrawers"
import { useFactPick } from "./useFactPick"
import type { FactPick } from "./useFactPick"
import { useFactWords } from "./useFactWords"
import { useFailureToast } from "./useFailureToast"

/** What the address asks of the facts page: the fact drawer it may open. */
interface BrainFactsInput {
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/** The states the facts page is narrowed to. */
const FACT_STATUS_FILTERS = ["all", "waiting", "active", "conflict", "retired"] as const

/** One state the facts page is narrowed to. */
type FactStatusFilter = (typeof FACT_STATUS_FILTERS)[number]

/** The kind of key each state keeps; "all" keeps every key still in use or waiting. */
const KIND_OF: Readonly<Record<Exclude<FactStatusFilter, "all">, FactKey["kind"]>> = {
    waiting: "fresh",
    active: "settled",
    conflict: "conflict",
    retired: "retired",
}

/** Whether a key falls under a state. */
const isIn = (one: FactKey, filter: FactStatusFilter): boolean =>
    filter === "all" ? one.kind !== "retired" : one.kind === KIND_OF[filter]

/** The words of a key the search reads: what it is about and its values. */
const wordsOfKey = (one: FactKey): string =>
    [one.lead.subjectLabel, one.lead.attributeLabel, ...one.options.map((fact) => fact.value), one.lead.value]
        .join(" ")
        .toLowerCase()

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
    readonly drawer: FactDrawerView | null
    /** The map of the same facts: the card's way of drawing them, the audience views and the side pane. */
    readonly map: FactMapState
    readonly on: {
        readonly setStatus: (id: string) => void
        readonly setQuery: (value: string) => void
        readonly setGrouping: (id: string) => void
        readonly retry: () => void
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
    const keys = factKeysOf(board.facts)
    const needle = query.trim().toLowerCase()
    const shown = keys.filter((one) => isIn(one, status) && (needle === "" || wordsOfKey(one).includes(needle)))
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
    const isDue = board.canWrite && needsMaintenance(board.facts, board.nowMs)
    return {
        ...drawers,
        slot: mapSlot(board.slot, () => pick.groups),
        copy,
        count: shown.length,
        filters: { status: statusTabs, selected: status, query, grouping },
        canWrite: board.canWrite,
        maintain: isDue
            ? { title: brain("maintainTitle"), body: brain("maintainBody"), actionLabel: brain("maintainAction") }
            : null,
        pick,
        drawer,
        map,
        on: {
            setStatus: (id) => setStatus(FACT_STATUS_FILTERS.find((one) => one === id) ?? status),
            setQuery,
            setGrouping: (id) => setGrouping(id === "document" ? "document" : "subject"),
            retry: board.reload,
            maintain: () => {
                command.send("brain.maintain", undefined).catch(failed)
            },
        },
    }
}
