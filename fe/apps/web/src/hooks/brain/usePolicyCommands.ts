"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    QUERY_BRAIN_POLICIES_SWR_KEY,
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    useMutateDecideBrainFactSwr,
    useMutateSetBrainPolicySwr,
} from "@/hooks/swr"
import { validFromOf, type PolicyDetailData } from "@/modules/brain"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import type { PolicyFormView } from "@/modules/types"
import { mutate } from "@/modules/viewer-cache"

/** The problems the back end names, each with its own sentence. */
const PROBLEMS = [
    "empty",
    "too_long",
    "not_money",
    "not_percent",
    "not_duration",
    "not_time_range",
    "not_boolean",
    "not_found",
    "not_a_policy",
    "window",
    "nothing_to_change",
    "owner_only",
    "not_in_force",
] as const

type Problem = (typeof PROBLEMS)[number]

/** The problem a refused write names, or null for one this screen has no sentence for. */
const problemOf = (code: string | null): Problem | null => PROBLEMS.find((one) => one === code) ?? null

/** A cache key of the rules, the opened rule, the brain or its to-do count: a write or a decision changes each. */
const isPolicyRead = (key: unknown): boolean =>
    Array.isArray(key) &&
    typeof key[0] === "string" &&
    (key[0].startsWith(QUERY_BRAIN_POLICIES_SWR_KEY) ||
        key[0] === QUERY_BRAIN_SWR_KEY ||
        key[0] === QUERY_BRAIN_TODO_SWR_KEY)

/** Reads the rules, the opened rule and what counts on them again. */
const refresh = async (): Promise<void> => {
    await mutate(isPolicyRead)
}

/** What one save sends: the value typed and the value the drawer opened with, the form and the form it opened with. */
export interface PolicySave {
    readonly detail: NonNullable<PolicyDetailData>
    readonly form: PolicyFormView
    readonly base: PolicyFormView
    readonly value: string
    readonly initial: string
}

/** The request of a save: the value when it changed (or is scheduled), the day it starts, and who may read it when that changed. */
const requestOf = (save: PolicySave) => ({
    factId: save.detail.row.factId,
    ...(save.value !== save.initial || save.form.effective === "from" || save.detail.row.current === null
        ? { value: save.value }
        : {}),
    ...(save.form.effective === "from" ? { validFrom: validFromOf(save.form.date) } : {}),
    ...(save.form.customers === save.base.customers ? {} : { audience: save.form.customers ? "public" : "internal" }),
})

/** The writes of the drawer and their state. */
export interface PolicyCommands {
    readonly isSaving: boolean
    /** The proposal a decision runs on, with the decision (`id:use`, `id:reject`); undefined when none runs. */
    readonly deciding: string | undefined
    /** Saves the form: answers the sentence of a refused value, or null once it went through (or failed with the failure toast). */
    readonly save: (input: PolicySave, dayMonth: (iso: string) => string) => Promise<string | null | undefined>
    readonly decide: (
        detail: NonNullable<PolicyDetailData>,
        proposalId: string,
        action: "use" | "reject",
    ) => Promise<void>
}

/**
 * The writes of the drawer: `setBrainPolicy` for a save (its outcome said in a toast, a refused value answered as its sentence) and the
 * existing `decideBrainFact` for a proposal (its `useAction`, or reject). Each write that went through reads the rules again.
 */
export const usePolicyCommands = (): PolicyCommands => {
    const p = useTranslations("brainPolicies")
    const runGraphQL = useGraphQLWithToast()
    const setPolicy = useMutateSetBrainPolicySwr()
    const decideFact = useMutateDecideBrainFactSwr()
    const [deciding, setDeciding] = useState<string | undefined>()
    const save: PolicyCommands["save"] = async (input, dayMonth) => {
        const answer = await runGraphQL(() => setPolicy.trigger(requestOf(input)), { showSuccessToast: false })
        if (answer === undefined) return undefined
        if (answer.outcome === "invalid") {
            const problem = problemOf(answer.problem)
            return problem === null ? p("problem_other") : p(`problem_${problem}`)
        }
        if (answer.outcome === "scheduled")
            toast.success(p("scheduledDone", { date: dayMonth(validFromOf(input.form.date)) }))
        else if (answer.outcome === "proposed") toast.success(p("proposed"))
        else if (answer.outcome === "unchanged") toast.success(p("unchanged"))
        else toast.success(p("applied"))
        await refresh()
        return null
    }
    const decide: PolicyCommands["decide"] = async (detail, proposalId, action) => {
        const proposal = detail.proposals.find((one) => one.factId === proposalId)
        if (proposal === undefined || !detail.canEdit || deciding !== undefined) return
        setDeciding(`${proposalId}:${action}`)
        try {
            const answer = await runGraphQL(
                () => decideFact.trigger({ id: proposalId, action: action === "use" ? proposal.useAction : "reject" }),
                { successMessage: action === "use" ? p("used") : p("rejected") },
            )
            if (answer !== undefined) await refresh()
        } finally {
            setDeciding(undefined)
        }
    }
    return { isSaving: setPolicy.isMutating, deciding, save, decide }
}
