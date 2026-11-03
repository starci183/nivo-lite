"use client"
import { useGraphQLWithToast } from "@/modules/toast"
import { useFeatureReset, useFeatureLifetime } from "@/hooks/reuseables"
import { useState } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { useHiringRun, type HiringOwner } from "@/hooks/hiring"
import type { HiringViews, HiringRequestOutcome } from "@/modules/types"

/** Sends the submitted form and resolves with what the request came to. */
type HiringRequestSend<Values> = (submitted: Values) => Promise<HiringViews["requestOutcome"]>

/** The send of a candidate request form, the outcome it came to and the reset on close; what is sent is the caller's. */
export const useHiringRequest = <Values extends FieldValues>(
    form: UseFormReturn<Values>,
    owner: HiringOwner | undefined,
    sendRequest: HiringRequestSend<Values>,
): {
    outcome: HiringRequestOutcome | null
    isPending: boolean
    error: string | null
    send: () => void
    reset: () => void
} => {
    const run = useHiringRun(owner)
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    const [outcome, setOutcome] = useState<HiringViews["requestOutcome"] | null>(null)
    const submit = (isCurrent: () => boolean) =>
        form.handleSubmit((submitted) => {
            if (!isCurrent()) return
            run.dispatch(
                () => sendRequest(submitted),
                undefined,
                (sent) => {
                    if (isCurrent()) setOutcome({ status: sent.status, summary: sent.summary })
                },
            )
        })
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => {
            setOutcome(null)
        },
    })
    return {
        outcome,
        isPending: run.isPending || form.formState.isSubmitting,
        error: run.error,
        send: () => {
            const isCurrent = lifetime.capture()
            if (!isCurrent()) return
            submit(isCurrent)().catch((error) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
        reset: () => {
            form.reset()
            setOutcome(null)
            run.clear()
        },
    }
}
