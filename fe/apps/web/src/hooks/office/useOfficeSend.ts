"use client"

import { useCallback, useMemo, useState } from "react"
import { CHAT_FILE_ACCEPT, useChatFile } from "@/hooks/chatFile"
import { useMutatePostOfficeMessageSwr, useMutateRequestOfficeFileUploadSwr } from "@/hooks/swr"
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

/**
 * Posts a line to the Office: an optimistic bubble kept until the server copy is in the thread data, then the post. The server reads the
 * tags of the line in the same transaction and wakes each agent it may ask, so the command card and the answer arrive by the chat
 * activity refresh; the client no longer asks for the command read.
 */
export const useOfficeSend = (knownIds: ReadonlySet<string>) => {
    const runGraphQL = useGraphQLWithToast()
    const post = useMutatePostOfficeMessageSwr()
    const uploadAddress = useMutateRequestOfficeFileUploadSwr()
    const file = useChatFile()
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
            const sentFile = await file.upload((chosen) =>
                runGraphQL(() => uploadAddress.trigger({ contentType: chosen.type, sizeBytes: chosen.size }), {
                    showSuccessToast: false,
                }),
            )
            const posted =
                sentFile === undefined
                    ? undefined
                    : await runGraphQL(() => post.trigger({ body: plan.body, room: plan.room, file: sentFile }), {
                          showSuccessToast: false,
                      })
            if (posted === undefined) {
                setOutbox((current) => current.map((row) => (row.id === id ? { ...row, isFailed: true } : row)))
                setTyping(null)
                setReading(null)
                return false
            }
            setOutbox((current) => current.map((row) => (row.id === id ? { ...row, postedId: posted.id } : row)))
            file.clear()
            await refreshOffice()
            setTyping(null)
            setReading(null)
            return true
        },
        [runGraphQL, post, isSettled, file, uploadAddress],
    )

    const dismissFailed = useCallback(() => setOutbox((current) => current.filter((row) => !row.isFailed)), [])
    const views = useMemo<ReadonlyArray<OfficeOutboxView>>(
        () =>
            outbox
                .filter((row) => !isSettled(row))
                .map((row) => ({ id: row.id, parts: bodyPartsOf(row.body), isFailed: row.isFailed })),
        [outbox, isSettled],
    )
    return {
        send,
        dismissFailed,
        outbox: views,
        typing,
        reading,
        isSending: post.isMutating || uploadAddress.isMutating,
        fileControl: { ...file, accept: CHAT_FILE_ACCEPT },
    }
}
