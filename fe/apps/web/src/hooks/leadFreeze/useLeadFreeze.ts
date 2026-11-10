"use client"

import { useCallback } from "react"
import { useMutateDecideLeadFreezeSwr, useQueryLeadFreezeSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"

/** The owner's three answers to a frozen customer. */
export type LeadFreezeAnswer = "retry" | "take_over" | "skip"

/** Which customer to read: the lead on its page, else the run on its page. */
export interface LeadFreezeTarget {
    /** The lead, or an empty text. */
    readonly leadId: string
    /** The run, or an empty text. */
    readonly runId: string
}

/** What the pages draw of a frozen customer. */
export interface LeadFreezeFacts {
    /** Whether the owner's retry is running. */
    readonly isRetrying: boolean
    /** The title of the failed step, or null. */
    readonly stepTitle: string | null
    /** How many events wait to be replayed. */
    readonly pendingCount: number
    /** Who took the conversation over, or null. */
    readonly heldBy: string | null
}

/** The freeze of a customer and the owner's answer to it. */
export interface LeadFreezeData {
    /** The freeze, or null while the customer is not frozen. */
    readonly freeze: LeadFreezeFacts | null
    /** Whether an answer is being sent. */
    readonly isAnswering: boolean
    /** Sends an answer; a failure is toasted. */
    readonly answer: (action: LeadFreezeAnswer) => void
}

/** The request of the read: the run first, then the lead, else nothing yet. */
const requestOf = (target: LeadFreezeTarget) => {
    if (target.runId !== "") return { runId: target.runId }
    return target.leadId === "" ? null : { leadId: target.leadId }
}

/** Reads whether a customer waits for the owner to handle a failed run, and sends the owner's answer. */
export const useLeadFreeze = (target: LeadFreezeTarget): LeadFreezeData => {
    const runGraphQL = useGraphQLWithToast()
    const read = useQueryLeadFreezeSwr(requestOf(target))
    const decide = useMutateDecideLeadFreezeSwr()
    const found = read.data ?? null
    const freezeId = found?.id ?? ""
    const answer = useCallback(
        (action: LeadFreezeAnswer): void => {
            if (freezeId === "") return
            void runGraphQL(
                async () => {
                    await decide.trigger({ freezeId, action })
                },
                { showSuccessToast: false },
            )
        },
        [decide, freezeId, runGraphQL],
    )
    const freeze =
        found === null
            ? null
            : {
                  isRetrying: found.status === "retrying",
                  stepTitle: found.stepTitle ?? null,
                  pendingCount: found.pendingCount,
                  heldBy: found.heldBy ?? null,
              }
    return { freeze, isAnswering: decide.isMutating, answer }
}
