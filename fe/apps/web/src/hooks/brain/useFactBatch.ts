"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
    QUERY_BRAIN_FACTS_PAGE_SWR_KEY,
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    type MutateDecideBrainFactRequest,
    type MutateKeepCurrentBrainFactRequest,
} from "@/hooks/swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { toast } from "@/modules/toast"
import { mutate } from "@/modules/viewer-cache"
import { useBrainFactTriggers } from "./useBrainFactTriggers"

/** One decision of a batch: a decision on one fact, or keeping the value in force of a key. */
export type FactOperation =
    | { readonly kind: "decide"; readonly request: MutateDecideBrainFactRequest }
    | { readonly kind: "keep"; readonly request: MutateKeepCurrentBrainFactRequest }

/** How many decisions run at once: the back end applies each in its own transaction. */
const AT_ONCE = 6

/** What a batch of decisions gives its caller. */
interface FactBatch {
    readonly isPending: boolean
    /** Sends every decision, reads the brain and the to-do count again once, and toasts the outcome. Answers how many went through. */
    readonly run: (operations: ReadonlyArray<FactOperation>, done: (count: number) => string) => Promise<number>
}

/**
 * Sends many fact decisions together (the ticked rows of the inbox, the choice of a comparison) a few at a time, then reads the brain and
 * the to-do count again once instead of once per decision. One toast says how many went through, another how many did not.
 */
export const useFactBatch = (): FactBatch => {
    const t = useTranslations("brainInbox")
    const workspace = useWorkspaceKey(QUERY_BRAIN_SWR_KEY, [])
    const { triggers } = useBrainFactTriggers()
    const [isPending, setIsPending] = useState(false)
    const send = (operation: FactOperation): Promise<unknown> =>
        operation.kind === "decide"
            ? triggers["fact.decide"](operation.request)
            : triggers["fact.keep"](operation.request)
    const run = async (operations: ReadonlyArray<FactOperation>, done: (count: number) => string): Promise<number> => {
        if (workspace === null || operations.length === 0) return 0
        setIsPending(true)
        const chunks = Array.from({ length: Math.ceil(operations.length / AT_ONCE) }, (_, index) =>
            operations.slice(index * AT_ONCE, (index + 1) * AT_ONCE),
        )
        // One chunk after the other, the decisions of a chunk together: the count of those that went through.
        const sendChunk = async (chunk: ReadonlyArray<FactOperation>): Promise<number> =>
            (await Promise.allSettled(chunk.map((entry) => send(entry)))).filter((outcome) => outcome.status === "fulfilled").length
        let passed = 0
        try {
            passed = await chunks.reduce<Promise<number>>(
                async (sofar, chunk) => (await sofar) + (await sendChunk(chunk)),
                Promise.resolve(0),
            )
            await mutate(
                (key) =>
                    Array.isArray(key) &&
                    key[1] === workspace[1] &&
                    (key[0] === QUERY_BRAIN_SWR_KEY ||
                        key[0] === QUERY_BRAIN_TODO_SWR_KEY ||
                        key[0] === QUERY_BRAIN_FACTS_PAGE_SWR_KEY),
            )
        } finally {
            setIsPending(false)
        }
        if (passed > 0) toast.success(done(passed))
        if (passed < operations.length) toast.danger(t("batchFailed", { count: operations.length - passed }))
        return passed
    }
    return { isPending, run }
}
