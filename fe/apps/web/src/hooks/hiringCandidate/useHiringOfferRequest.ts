"use client"
import type { UseFormReturn } from "react-hook-form"
import type { HiringOwner } from "@/hooks/hiring"
import type { FieldOf, HiringRequestOutcome } from "@/modules/types"
import { useMutateRequestHiringOfferSwr } from "@/hooks/swr"
import type { OfferValues } from "./hiringCandidate.shared"
import { useHiringRequest } from "./useHiringRequest"

/** The view `useHiringOfferRequest` returns. */
export interface HiringOfferRequestView {
    values: OfferValues
    canSend: boolean
    setText: (name: FieldOf<OfferValues, string>, value: string) => void
    outcome: HiringRequestOutcome | null
    isPending: boolean
    error: string | null
    send: () => void
    reset: () => void
}

/** The offer request of one candidate: the form values, the send that shows what the request came to, and the reset on close. */
export const useHiringOfferRequest = (
    form: UseFormReturn<OfferValues>,
    candidateId: string,
    owner?: HiringOwner,
): HiringOfferRequestView => {
    const { trigger } = useMutateRequestHiringOfferSwr()
    const request = useHiringRequest(form, owner, (submitted) => trigger({ candidateId, ...submitted }))
    const values = form.watch()
    return {
        ...request,
        values,
        canSend: values.pay.trim() !== "",
        setText: (name: FieldOf<OfferValues, string>, value: string) =>
            form.setValue(name, value, { shouldValidate: true }),
    }
}
