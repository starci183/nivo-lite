"use client"

import { useState } from "react"
import { useFailureToast } from "./useFailureToast"

/** The one action a list of rows offers, when it may run and what it sends. */
interface BrainRowActionInput {
    /** The id of the action on every row. */
    readonly actionId: string
    readonly canWrite: boolean
    /** Whether the row is still one the list offers. */
    readonly isKnown: (rowId: string) => boolean
    readonly send: (rowId: string) => Promise<unknown>
}

/** The view `useBrainRowAction` returns. */
export interface BrainRowActionView {
    pending: string | undefined
    dispatch: (rowId: string, actionId: string) => void
}

/** Runs the one action of a list of rows, one row at a time: the row it is running on, and the handler of the row's action. */
export const useBrainRowAction = (input: BrainRowActionInput): BrainRowActionView => {
    const failed = useFailureToast()
    const [pending, setPending] = useState<string | undefined>()
    const run = async (rowId: string, actionId: string) => {
        if (!input.canWrite || actionId !== input.actionId || pending !== undefined || !input.isKnown(rowId)) return
        setPending(rowId)
        try {
            await input.send(rowId)
        } catch {
            failed()
        } finally {
            setPending(undefined)
        }
    }
    const dispatch = (rowId: string, actionId: string) => {
        run(rowId, actionId).catch(failed)
    }
    return { pending, dispatch }
}
