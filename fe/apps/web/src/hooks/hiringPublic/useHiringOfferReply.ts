"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutateRespondHiringOfferSwr } from "@/hooks/swr"
import { graphQLErrorCode } from "@/modules/failure"
import { useGraphQLWithToast } from "@/modules/toast"
import type { ReplyOutcome } from "./useHiringInterviewReply"

const ANSWERED_OUTCOMES: ReadonlySet<string> = new Set(["accepted", "declined", "already_accepted", "already_declined"])

/** The candidate's answer to a job offer: accept it or decline it. */
export const useHiringOfferReply = (token: string) => {
    const t = useTranslations("hiring")
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateRespondHiringOfferSwr()
    const [isPending, setPending] = useState(false)
    const [outcome, setOutcome] = useState<ReplyOutcome | null>(null)
    const answer = async (accept: boolean) => {
        setPending(true)
        const result = await runGraphQL(
            async () => {
                try {
                    return await trigger({ token, accept })
                } catch (error) {
                    if (graphQLErrorCode(error) === "HIRING_PUBLIC_NOT_FOUND") return { outcome: "invalid" }
                    throw error
                }
            },
            { showSuccessToast: false },
        )
        setPending(false)
        if (result !== undefined) {
            setOutcome({ isOk: ANSWERED_OUTCOMES.has(result.outcome), text: t(`replyOffer_${result.outcome}`) })
        }
    }
    return { outcome, isPending, answer: (accept: boolean) => void answer(accept) }
}
