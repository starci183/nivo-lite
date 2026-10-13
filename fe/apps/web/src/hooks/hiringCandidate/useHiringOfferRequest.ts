import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useHiringRun } from "@/hooks/hiring"
import type { FieldOf } from "@/hooks/hiring"
import { useMutateRequestHiringOfferSwr } from "@/hooks/swr"
import type { OfferValues, RequestOutcomeView } from "./hiringCandidate.shared"

/** The offer request of one candidate: the form values, the send that shows what the request came to, and the reset on close. */
export const useHiringOfferRequest = (form: UseFormReturn<OfferValues>, candidateId: string) => {
    const run = useHiringRun()
    const { trigger } = useMutateRequestHiringOfferSwr()
    const [outcome, setOutcome] = useState<RequestOutcomeView | null>(null)
    const values = form.watch()
    const submit = form.handleSubmit(async (submitted) => {
        const sent = await run.exec(() => trigger({ candidateId, ...submitted }))
        if (sent !== undefined) setOutcome({ status: sent.status, summary: sent.summary })
    })
    return {
        values,
        outcome,
        isPending: run.isPending,
        error: run.error,
        canSend: values.pay.trim() !== "",
        setText: (name: FieldOf<OfferValues, string>, value: string) =>
            form.setValue(name, value, { shouldValidate: true }),
        send: () => void submit(),
        reset: () => {
            form.reset()
            setOutcome(null)
            run.clear()
        },
    }
}
