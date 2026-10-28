"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloPage, useZaloTestSend } from "@/hooks/zaloConnection"
import { ZaloConnectionTestSendBase } from "./component"

/** What the page hands the test send: the connection of the url. */
interface ZaloConnectionTestSendProps {
    readonly connectionId: string
}

/** The connected test send of a Zalo OA connection: a real text through the delivery path to a follower inside the 48 hours. */
export const ZaloConnectionTestSend = (props: ZaloConnectionTestSendProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const { view, recipientId, setRecipient, text, setText, send, isSending, note, isNoteOk } = useZaloTestSend(
        props.connectionId,
    )
    const { reload } = useZaloPage(props.connectionId)
    return (
        <ZaloConnectionTestSendBase
            props={{
                title: t("testTitle"),
                hint: t("testHint"),
                send: view,
                slotLabels: slotLabels(t("testEmpty")),
                recipientLabel: t("testRecipient"),
                recipientId,
                textLabel: t("testText"),
                text,
                sendLabel: t("testSend"),
                isSending,
                note,
                noteTone: isNoteOk ? "affirmative" : "negative",
            }}
            on={{ pickRecipient: setRecipient, changeText: setText, send: () => void send(), retry: reload }}
        />
    )
}
