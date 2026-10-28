"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { mutate as mutateCache } from "swr"
import { useSettledGraphQL, useZaloFailureLabel } from "@/hooks/connection-wizard"
import { mapSlot } from "@/hooks/slot"
import { QUERY_ZALO_CONNECTION_EVENTS_SWR_KEY, useMutateSendZaloTestMessageSwr } from "@/hooks/swr"
import type { DataSlot, ZaloSendView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"

/** The test send: who the free 48 hours allow, the text, and the real send through the delivery path. */
export const useZaloTestSend = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const format = useFormatter()
    const settle = useSettledGraphQL()
    const labelOf = useZaloFailureLabel()
    const { slot } = useZaloPage(connectionId)
    const { trigger, isMutating } = useMutateSendZaloTestMessageSwr()
    const [picked, setPicked] = useState("")
    const [text, setText] = useState(t("testDefaultText"))
    const [note, setNote] = useState<{ readonly text: string; readonly isOk: boolean }>({ text: "", isOk: false })

    const view: DataSlot<ZaloSendView> = mapSlot(slot, (page) => {
        const blocks: Readonly<Record<string, string>> = {
            not_authorized: t("blockNotAuthorized"),
            token_expired: t("blockTokenExpired"),
            no_recipient: t("blockNoRecipient"),
        }
        return {
            options: page.recipients.map((one) => ({
                id: one.userId,
                label: t("recipientLine", {
                    name: one.name === "" ? one.userId : one.name,
                    ago: format.relativeTime(new Date(one.lastMessageAt), new Date()),
                }),
            })),
            blocked: page.sendBlock === null ? "" : (blocks[page.sendBlock] ?? t("blockTokenExpired")),
        }
    })
    const recipientId = picked === "" ? (slot.items?.recipients[0]?.userId ?? "") : picked

    const send = useCallback(async (): Promise<void> => {
        setNote({ text: "", isOk: false })
        const result = await settle(() => trigger({ connectionId, recipientId, text }))
        if (result.kind !== "ok") return setNote({ text: labelOf(result.code, result.message), isOk: false })
        const reason = result.value.failure ?? ""
        await mutateCache((key) => Array.isArray(key) && key[0] === QUERY_ZALO_CONNECTION_EVENTS_SWR_KEY)
        setNote(
            result.value.sent
                ? { text: t("testSent"), isOk: true }
                : { text: t("testFailed", { reason: labelOf(reason, reason) }), isOk: false },
        )
    }, [settle, labelOf, trigger, connectionId, recipientId, text, t])

    return {
        view,
        recipientId,
        setRecipient: setPicked,
        text,
        setText,
        send,
        isSending: isMutating,
        note: note.text,
        isNoteOk: note.isOk,
    }
}
