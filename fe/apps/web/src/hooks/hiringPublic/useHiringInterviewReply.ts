"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useHiringFormat } from "@/hooks/hiring"
import { useMutateRespondHiringInterviewSwr } from "@/hooks/swr"
import { graphQLErrorCode } from "@/modules/failure"
import { useGraphQLWithToast } from "@/modules/toast"

/** What an answer to an invitation or an offer came to, in the reader's words. */
export interface ReplyOutcome {
    readonly isOk: boolean
    readonly text: string
}

const PICKED_OUTCOMES: ReadonlySet<string> = new Set(["confirmed", "already_confirmed", "none_fit"])

/** The candidate's answer to an interview invitation: pick a time, or say none fits. */
export const useHiringInterviewReply = (token: string) => {
    const t = useTranslations("hiring")
    const format = useHiringFormat()
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateRespondHiringInterviewSwr()
    const [isPending, setPending] = useState(false)
    const [outcome, setOutcome] = useState<ReplyOutcome | null>(null)
    const pick = async (start: string | null) => {
        setPending(true)
        const result = await runGraphQL(
            async () => {
                try {
                    return await trigger({ token, ...(start === null ? {} : { start }) })
                } catch (error) {
                    if (graphQLErrorCode(error) === "HIRING_PUBLIC_NOT_FOUND")
                        return { outcome: "invalid", slotStart: null }
                    throw error
                }
            },
            { showSuccessToast: false },
        )
        setPending(false)
        if (result === undefined) return
        setOutcome({
            isOk: PICKED_OUTCOMES.has(result.outcome),
            text:
                result.outcome === "confirmed" && result.slotStart !== null
                    ? t("replyConfirmedAt", { when: format.dateTime(result.slotStart) })
                    : t(`replyInterview_${result.outcome}`),
        })
    }
    return { outcome, isPending, pick: (start: string | null) => void pick(start) }
}
