"use client"
import { useGraphQLWithToast } from "@/modules/toast"

import { useFeatureReset, useFeatureLifetime } from "@/hooks/reuseables"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useHiringRun, type HiringOwner } from "@/hooks/hiring"
import type { FieldOf, HiringViews } from "@/modules/types"
import { useMutateRequestHiringInterviewSwr } from "@/hooks/swr"
import type { InterviewValues } from "./hiringCandidate.shared"

const FIELD_OPTIONS = { shouldValidate: true }

/** The interview request of one candidate: the form values, the send that shows what the request came to, and the reset on close. */
export const useHiringInterviewRequest = (
    form: UseFormReturn<InterviewValues>,
    candidateId: string,
    owner?: HiringOwner,
) => {
    const run = useHiringRun(owner)
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    const { trigger } = useMutateRequestHiringInterviewSwr()
    const [outcome, setOutcome] = useState<HiringViews["requestOutcome"] | null>(null)
    const values = form.watch()
    const submit = (isCurrent: () => boolean) =>
        form.handleSubmit((submitted) => {
            if (!isCurrent()) return
            run.dispatch(
                () =>
                    trigger({
                        candidateId,
                        interviewerUserId: submitted.interviewerUserId === "" ? null : submitted.interviewerUserId,
                        mode: submitted.mode,
                        location: submitted.location,
                        durationMin: submitted.durationMin,
                    }),
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
        values,
        outcome,
        isPending: run.isPending || form.formState.isSubmitting,
        error: run.error,
        canSend: values.mode !== "online" || values.location.trim() !== "",
        setText: (name: FieldOf<InterviewValues, string>, value: string) => form.setValue(name, value, FIELD_OPTIONS),
        setNumber: (name: FieldOf<InterviewValues, number>, value: number) => form.setValue(name, value, FIELD_OPTIONS),
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
