"use client"
import type { UseFormReturn } from "react-hook-form"
import type { HiringOwner } from "@/hooks/hiring"
import type { FieldOf, HiringRequestOutcome } from "@/modules/types"
import { useMutateRequestHiringInterviewSwr } from "@/hooks/swr"
import type { InterviewValues } from "./hiringCandidate.shared"
import { useHiringRequest } from "./useHiringRequest"

const FIELD_OPTIONS = { shouldValidate: true }

/** The view `useHiringInterviewRequest` returns. */
export interface HiringInterviewRequestView {
    values: InterviewValues
    canSend: boolean
    setText: (name: FieldOf<InterviewValues, string>, value: string) => void
    setNumber: (name: FieldOf<InterviewValues, number>, value: number) => void
    outcome: HiringRequestOutcome | null
    isPending: boolean
    error: string | null
    send: () => void
    reset: () => void
}

/** The interview request of one candidate: the form values, the send that shows what the request came to, and the reset on close. */
export const useHiringInterviewRequest = (
    form: UseFormReturn<InterviewValues>,
    candidateId: string,
    owner?: HiringOwner,
): HiringInterviewRequestView => {
    const { trigger } = useMutateRequestHiringInterviewSwr()
    const request = useHiringRequest(form, owner, (submitted) =>
        trigger({
            candidateId,
            interviewerUserId: submitted.interviewerUserId === "" ? null : submitted.interviewerUserId,
            mode: submitted.mode,
            location: submitted.location,
            durationMin: submitted.durationMin,
        }),
    )
    const values = form.watch()
    return {
        ...request,
        values,
        canSend: values.mode !== "online" || values.location.trim() !== "",
        setText: (name: FieldOf<InterviewValues, string>, value: string) => form.setValue(name, value, FIELD_OPTIONS),
        setNumber: (name: FieldOf<InterviewValues, number>, value: number) => form.setValue(name, value, FIELD_OPTIONS),
    }
}
