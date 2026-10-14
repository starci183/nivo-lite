"use client"

import { useCallback, useState } from "react"
import { useMutatePostOfficeMessageSwr, useMutateProposeOfficeCommandSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { bodyPartsOf } from "@/modules/office"
import type { OfficeOutboxView } from "@/modules/types"
import { refreshOffice } from "./office.shared"

/** The one agent that takes commands, drawn as the card skeleton while the line is read. */
interface ReadingAgent {
    readonly handle: string
    readonly module: string
}

/** What a send needs to know about the line. */
interface SendPlan {
    readonly body: string
    /** True when an owner or manager's line should also be read as a command. */
    readonly shouldPropose: boolean
    /** The names of the agents the line calls, drawn as "typing". */
    readonly callNames: ReadonlyArray<string>
    readonly reading: ReadingAgent | null
}

interface OutboxRow {
    readonly id: string
    readonly body: string
    readonly isFailed: boolean
}

/** Posts a line to the Office: an optimistic bubble, the post, then (for an owner or manager) the read as a command. */
export const useOfficeSend = () => {
    const runGraphQL = useGraphQLWithToast()
    const post = useMutatePostOfficeMessageSwr()
    const propose = useMutateProposeOfficeCommandSwr()
    const [outbox, setOutbox] = useState<ReadonlyArray<OutboxRow>>([])
    const [typing, setTyping] = useState<string | null>(null)
    const [reading, setReading] = useState<ReadingAgent | null>(null)

    const send = useCallback(
        async (plan: SendPlan): Promise<boolean> => {
            const id = `pending-${Date.now()}`
            setOutbox((current) => [...current, { id, body: plan.body, isFailed: false }])
            setTyping(plan.callNames.length > 0 ? plan.callNames.join(", ") : null)
            setReading(plan.reading)
            const posted = await runGraphQL(() => post.trigger({ body: plan.body }), { showSuccessToast: false })
            if (posted === undefined) {
                setOutbox((current) => current.map((row) => (row.id === id ? { ...row, isFailed: true } : row)))
                setTyping(null)
                setReading(null)
                return false
            }
            if (plan.shouldPropose) {
                await runGraphQL(() => propose.trigger({ messageId: posted.id }), { showSuccessToast: false })
            }
            await refreshOffice()
            setOutbox((current) => current.filter((row) => row.id !== id))
            setTyping(null)
            setReading(null)
            return true
        },
        [runGraphQL, post, propose],
    )

    const dismissFailed = useCallback(() => setOutbox((current) => current.filter((row) => !row.isFailed)), [])
    const views: ReadonlyArray<OfficeOutboxView> = outbox.map((row) => ({
        id: row.id,
        parts: bodyPartsOf(row.body),
        isFailed: row.isFailed,
    }))
    return { send, dismissFailed, outbox: views, typing, reading, isSending: post.isMutating || propose.isMutating }
}
