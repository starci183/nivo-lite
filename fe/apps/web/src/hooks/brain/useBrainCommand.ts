"use client"

import { useTranslations } from "next-intl"
import { mutate } from "@/modules/viewer-cache"
import { QUERY_BRAIN_FACTS_PAGE_SWR_KEY, QUERY_BRAIN_SWR_KEY, QUERY_BRAIN_TODO_SWR_KEY } from "@/hooks/swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useBrainFactTriggers, type BrainFactRequests } from "./useBrainFactTriggers"
import { useBrainLessonTriggers, type BrainLessonRequests } from "./useBrainLessonTriggers"

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
    ) => Promise<true | undefined>
}

/** A card of the Second Brain that asks the back end to do something: a fact decision, a lesson, a dismissed question. */
export const useBrainCommand = (): BrainCommand => {
    const runGraphQL = useGraphQLWithToast()
    const feedback = useTranslations("toast")
    const workspace = useWorkspaceKey(QUERY_BRAIN_SWR_KEY, [])
    const facts = useBrainFactTriggers()
    const lessons = useBrainLessonTriggers()
    const triggers: BrainCommandTriggers = { ...facts.triggers, ...lessons.triggers }
    const send = async <Kind extends BrainCommandKind>(
        kind: Kind,
        request: BrainCommandRequests[Kind],
        options?: SendOptions,
    ) => {
        if (workspace === null) return undefined
        try {
            const result = await runGraphQL(() => triggers[kind](request), {
                successMessage: options?.done,
                showSuccessToast: options?.done !== undefined,
            })
            if (result === undefined) return undefined
            options?.onResult?.(result)
            await mutate(
                (key) =>
                    Array.isArray(key) &&
                    key[1] === workspace[1] &&
                    (key[0] === QUERY_BRAIN_SWR_KEY ||
                        key[0] === QUERY_BRAIN_TODO_SWR_KEY ||
                        key[0] === QUERY_BRAIN_FACTS_PAGE_SWR_KEY),
            )
            return true as const
        } catch {
            toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
            return undefined
        }
    }
    return { isPending: facts.isPending || lessons.isPending, send }
}
