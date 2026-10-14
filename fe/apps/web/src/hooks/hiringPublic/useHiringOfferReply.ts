"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutateRespondHiringOfferSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import type { ReplyOutcome } from "./useHiringInterviewReply"

const ANSWERED_OUTCOMES: ReadonlyArray<string> = ["accepted", "declined", "already_accepted", "already_declined"]

/** The candidate's answer to a job offer: accept it or decline it. */
export const useHiringOfferReply = (token: string) => {
    const t = useTranslations("hiring")
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateRespondHiringOfferSwr()
    const [isPending, setPending] = useState(false)
    const [outcome, setOutcome] = useState<ReplyOutcome | null>(null)
    const answer = async (accept: boolean) => {
        setPending(true)
        const result = await runGraphQL(() => trigger({ token, accept }), { showSuccessToast: false })
        setPending(false)
        if (result !== undefined) {
            setOutcome({ isOk: ANSWERED_OUTCOMES.includes(result.outcome), text: t(`replyOffer_${result.outcome}`) })
        }
    }
    return { outcome, isPending, answer: (accept: boolean) => void answer(accept) }
}
