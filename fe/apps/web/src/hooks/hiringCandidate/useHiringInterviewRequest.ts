"use client"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useHiringRun } from "@/hooks/hiring"
import type { FieldOf } from "@/hooks/hiring"
import { useMutateRequestHiringInterviewSwr } from "@/hooks/swr"
import type { InterviewValues, RequestOutcomeView } from "./hiringCandidate.shared"

const FIELD_OPTIONS = { shouldValidate: true }

/** The interview request of one candidate: the form values, the send that shows what the request came to, and the reset on close. */
export const useHiringInterviewRequest = (form: UseFormReturn<InterviewValues>, candidateId: string) => {
    const run = useHiringRun()
    const { trigger } = useMutateRequestHiringInterviewSwr()
    const [outcome, setOutcome] = useState<RequestOutcomeView | null>(null)
    const values = form.watch()
    const submit = form.handleSubmit(async (submitted) => {
        const sent = await run.exec(() =>
            trigger({
                candidateId,
                interviewerUserId: submitted.interviewerUserId === "" ? null : submitted.interviewerUserId,
                mode: submitted.mode,
                location: submitted.location,
                durationMin: submitted.durationMin,
            }),
        )
        if (sent !== undefined) setOutcome({ status: sent.status, summary: sent.summary })
    })
    return {
        values,
        outcome,
        isPending: run.isPending,
        error: run.error,
        canSend: values.mode !== "online" || values.location.trim() !== "",
        setText: (name: FieldOf<InterviewValues, string>, value: string) => form.setValue(name, value, FIELD_OPTIONS),
        setNumber: (name: FieldOf<InterviewValues, number>, value: number) => form.setValue(name, value, FIELD_OPTIONS),
        send: () => void submit(),
        reset: () => {
            form.reset()
            setOutcome(null)
            run.clear()
        },
    }
}
