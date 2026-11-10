"use client"

import type { FactDrawerWords, FactKey } from "@/modules/brain"
import type { BrainTab } from "@/modules/routes"
import type { BrainBoard } from "./useBrainBoard"
import { useConflictDrawer } from "./useConflictDrawer"
import type { ConflictDrawerState } from "./useConflictDrawer"
import { useFactDetailDrawer } from "./useFactDetailDrawer"
import type { FactDetailDrawerState } from "./useFactDetailDrawer"

/** What the two drawers of a table of facts are read against. */
export interface FactDrawersInput {
    /** The page the drawers open on: the form that gives a fact a new value returns there. */
    readonly tab: BrainTab
    readonly board: BrainBoard
    readonly keys: ReadonlyArray<FactKey>
    readonly words: FactDrawerWords
}

/** The two drawers of a table of facts. */
export interface FactDrawers {
    readonly conflict: ConflictDrawerState
    readonly detail: FactDetailDrawerState
}

/** The comparison of a conflict and the detail of one fact, the two drawers the inbox and the facts page open from their rows. */
export const useFactDrawers = (input: FactDrawersInput): FactDrawers => {
    const { board, keys, words } = input
    const conflict = useConflictDrawer({ keys, lenses: board.lenses, canWrite: board.canWrite, words })
    const detail = useFactDetailDrawer({
        tab: input.tab,
        facts: board.facts,
        keys,
        lenses: board.lenses,
        canWrite: board.canWrite,
        words,
    })
    return { conflict, detail }
}
