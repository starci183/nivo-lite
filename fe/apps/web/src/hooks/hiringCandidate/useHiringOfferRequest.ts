"use client"
import type { UseFormReturn } from "react-hook-form"
import type { HiringOwner } from "@/hooks/hiring"
import type { FieldOf } from "@/modules/types"
import { useMutateRequestHiringOfferSwr } from "@/hooks/swr"
import type { OfferValues } from "./hiringCandidate.shared"
import { useHiringRequest } from "./useHiringRequest"

/** The offer request of one candidate: the form values, the send that shows what the request came to, and the reset on close. */
export const useHiringOfferRequest = (form: UseFormReturn<OfferValues>, candidateId: string, owner?: HiringOwner) => {
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
