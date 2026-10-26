"use client"

import { useCallback, useMemo, useState } from "react"
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
    /** The Hub room the line is posted in; null is the Office room. */
    readonly room: string | null
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
    /** The server id once the post succeeded; the row stays until the thread data holds this id. */
    readonly postedId: string | null
}

/** Posts a line to the Office: an optimistic bubble kept until the server copy is in the thread data, the post, then (for an owner or manager) the read as a command. */
export const useOfficeSend = (knownIds: ReadonlySet<string>) => {
    const runGraphQL = useGraphQLWithToast()
    const post = useMutatePostOfficeMessageSwr()
    const propose = useMutateProposeOfficeCommandSwr()
    const [outbox, setOutbox] = useState<ReadonlyArray<OutboxRow>>([])
    const [typing, setTyping] = useState<string | null>(null)
    const [reading, setReading] = useState<ReadingAgent | null>(null)

    const isSettled = useCallback((row: OutboxRow) => row.postedId !== null && knownIds.has(row.postedId), [knownIds])
    const send = useCallback(
        async (plan: SendPlan): Promise<boolean> => {
            const id = `pending-${Date.now()}`
            setOutbox((current) => [
                ...current.filter((row) => !isSettled(row)),
                { id, body: plan.body, isFailed: false, postedId: null },
            ])
            setTyping(plan.callNames.length > 0 ? plan.callNames.join(", ") : null)
            setReading(plan.reading)
            const posted = await runGraphQL(() => post.trigger({ body: plan.body, room: plan.room }), {
                showSuccessToast: false,
            })
            if (posted === undefined) {
                setOutbox((current) => current.map((row) => (row.id === id ? { ...row, isFailed: true } : row)))
                setTyping(null)
                setReading(null)
                return false
            }
            setOutbox((current) => current.map((row) => (row.id === id ? { ...row, postedId: posted.id } : row)))
            if (plan.shouldPropose) {
                await runGraphQL(() => propose.trigger({ messageId: posted.id }), { showSuccessToast: false })
            }
            await refreshOffice()
            setTyping(null)
            setReading(null)
            return true
        },
        [runGraphQL, post, propose, isSettled],
    )

    const dismissFailed = useCallback(() => setOutbox((current) => current.filter((row) => !row.isFailed)), [])
    const views = useMemo<ReadonlyArray<OfficeOutboxView>>(
        () =>
            outbox
                .filter((row) => !isSettled(row))
                .map((row) => ({ id: row.id, parts: bodyPartsOf(row.body), isFailed: row.isFailed })),
        [outbox, isSettled],
    )
    return { send, dismissFailed, outbox: views, typing, reading, isSending: post.isMutating || propose.isMutating }
}
