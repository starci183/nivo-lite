"use client"

import { mutate } from "swr"
import { QUERY_BRAIN_SWR_KEY, QUERY_BRAIN_TODO_SWR_KEY } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useBrainFactTriggers } from "./useBrainFactTriggers"
import type { BrainFactRequests } from "./useBrainFactTriggers"
import { useBrainLessonTriggers } from "./useBrainLessonTriggers"
import type { BrainLessonRequests } from "./useBrainLessonTriggers"

/** The requests of every kind of work a card of the Second Brain asks the back end for. */
type BrainCommandRequests = BrainFactRequests & BrainLessonRequests

/** The kinds of work a card of the Second Brain asks the back end for. */
export type BrainCommandKind = keyof BrainCommandRequests

/** Every trigger, each typed by its own request. */
type BrainCommandTriggers = {
    readonly [Kind in BrainCommandKind]: (request: BrainCommandRequests[Kind]) => Promise<unknown>
}

/** What a card wants to happen when its mutation went through. */
interface SendOptions {
    /** The words of the success toast; omitted = silent success. */
    readonly done?: string
    /** Called with the result the back end gave. */
    readonly onResult?: (result: unknown) => void
}

/** What the brain commands give a card. */
interface BrainCommand {
    readonly isPending: boolean
    /** Runs the matching mutation, toasts the failure, revalidates the brain read on success. */
    readonly send: <Kind extends BrainCommandKind>(
        kind: Kind,
        request: BrainCommandRequests[Kind],
        options?: SendOptions,
    ) => void
}

/** A card of the Second Brain that asks the back end to do something: a fact decision, a lesson, a dismissed question. */
export const useBrainCommand = (): BrainCommand => {
    const runGraphQL = useGraphQLWithToast()
    const facts = useBrainFactTriggers()
    const lessons = useBrainLessonTriggers()
    const triggers: BrainCommandTriggers = { ...facts.triggers, ...lessons.triggers }
    const send = <Kind extends BrainCommandKind>(
        kind: Kind,
        request: BrainCommandRequests[Kind],
        options?: SendOptions,
    ) => {
        void (async () => {
            const result = await runGraphQL(() => triggers[kind](request), {
                successMessage: options?.done,
                showSuccessToast: options?.done !== undefined,
            })
            if (result === undefined) return
            options?.onResult?.(result)
            await mutate(
                (key) => Array.isArray(key) && (key[0] === QUERY_BRAIN_SWR_KEY || key[0] === QUERY_BRAIN_TODO_SWR_KEY),
            )
        })()
    }
    return { isPending: facts.isPending || lessons.isPending, send }
}
