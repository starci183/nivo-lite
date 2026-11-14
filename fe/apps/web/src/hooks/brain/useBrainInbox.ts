"use client"

import { useState } from "react"
import { useKnowledgeSources } from "@/hooks/knowledge"
import { factKeysOf, trustLevelOf, type FactKey, type PickGrouping } from "@/modules/brain"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { InboxSideRowView, InboxView, KnowledgeListView, KnowledgeRowView } from "@/modules/types"
import { useWorkspaceId } from "@/hooks/workspaces"
import { useBrainBoard } from "./useBrainBoard"
import { useBrainGaps } from "./useBrainGaps"
import { useFactDrawer } from "./useFactDrawer"
import { useFactDrawers, type FactDrawers } from "./useFactDrawers"
import { useFactPick, type FactPick } from "./useFactPick"
import { useFactWords } from "./useFactWords"
import { useInboxConflicts } from "./useInboxConflicts"
import { usePublicProposals } from "./usePublicProposals"

/** What the address asks of the inbox: the fact form it may open (a new fact, a new value, the answer to a question). */
interface BrainInboxInput {
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/** What the inbox gives its block: what it draws, and the ticks and drawers that answer it. */
export interface BrainInbox extends FactDrawers {
    readonly view: InboxView
    readonly pick: FactPick
    readonly on: {
        readonly setTrust: (id: string) => void
        readonly setGrouping: (id: string) => void
        readonly dismissAsk: (id: string) => void
        readonly retry: () => void
    }
}

/** The rows a region drew, or none while it has none. */
const rowsOf = (list: KnowledgeListView): ReadonlyArray<KnowledgeRowView> =>
    "items" in list.slot ? list.slot.items : []

/** One row of a side card: the title, its first line, and where the command named `actionId` goes. */
const sideRowOf = (row: KnowledgeRowView, actionId: string): InboxSideRowView => ({
    id: row.id,
    title: row.title,
    line: row.lines?.[0] ?? "",
    href: row.actions?.find((action) => action.id === actionId)?.href ?? null,
})

/** Whether a fresh key is believed highly. */
const isHigh = (one: FactKey): boolean => trustLevelOf(one.lead.trust) === "high"

/** How far the agents are: the keys whose value is in use, of all the keys still in use or waiting. */
const progressOf = (keys: ReadonlyArray<FactKey>): InboxView["progress"] => ({
    used: keys.filter((one) => one.current?.status === "active").length,
    total: keys.filter((one) => one.kind !== "retired").length,
})

/**
 * The one inbox of the to-do tab: the facts waiting (the conflicts one by one, the fresh ones ticked together by document or by subject),
 * the customer questions without an answer and the public texts waiting. One key is one item, the way the rail and the tab count them.
 */
export const useBrainInbox = (input: BrainInboxInput): BrainInbox => {
    const workspaceId = useWorkspaceId()
    const board = useBrainBoard()
    const words = useFactWords()
    const sources = useKnowledgeSources().sources
    const gaps = useBrainGaps(board, { answer: "public" })
    const proposals = usePublicProposals()
    const [trust, setTrust] = useState<"all" | "high">("all")
    const [grouping, setGrouping] = useState<PickGrouping>("document")
    const keys = factKeysOf(board.facts)
    const fresh = keys.filter((one) => one.kind === "fresh")
    const topicOf = (sourceId: string) => sources?.find((source) => source.id === sourceId)?.topic ?? undefined
    const conflicts = useInboxConflicts({ keys, topicOf, words })
    const shown = trust === "high" ? fresh.filter((entry) => isHigh(entry)) : fresh
    const pick = useFactPick({ keys: shown, by: grouping, topicOf, words: words.pick, canWrite: board.canWrite })
    const drawers = useFactDrawers({ tab: "todo", board, keys, words: words.drawer })
    const factDrawer = useFactDrawer({ tab: "todo", fact: input.fact, edit: input.edit, answer: input.answer })
    return {
        ...drawers,
        pick,
        view: {
            isWaiting: "isLoading" in board.slot,
            isFailed: "isError" in board.slot || "isForbidden" in board.slot,
            canWrite: board.canWrite,
            ...conflicts,
            total: fresh.length,
            trust,
            trustCounts: { all: fresh.length, high: fresh.filter((entry) => isHigh(entry)).length },
            grouping,
            groups: pick.groups,
            bar: pick.bar,
            confirm: pick.confirm,
            progress: progressOf(keys),
            asks: rowsOf(gaps.list).map((row) => sideRowOf(row, "answer")),
            asksMoreHref: workspaceHref(workspaceId, brainTabHref("publicAsks")),
            proposals: rowsOf(proposals.list).map((row) => sideRowOf(row, "approve")),
            conflict: drawers.conflict.view,
            detail: drawers.detail.view,
            factDrawer,
        },
        on: {
            setTrust: (id) => setTrust(id === "high" ? "high" : "all"),
            setGrouping: (id) => setGrouping(id === "subject" ? "subject" : "document"),
            dismissAsk: (id) => gaps.dispatch(id, "dismiss"),
            retry: () => {
                board.reload()
                proposals.retry()
            },
        },
    }
}
