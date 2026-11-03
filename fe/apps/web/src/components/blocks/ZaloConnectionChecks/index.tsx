"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloChecks, useZaloPage, useZaloSetupStep, useZaloTestSend } from "@/hooks/zaloConnection"
import { ZaloConnectionChecksBase } from "./component"

/** What the page hands the step: the connection of the url. */
interface ZaloConnectionChecksProps {
    readonly connectionId: string
}

/**
 * The connected fourth setup step: the check list of a Zalo OA connection (the page header's "Check again" renews the token when it
 * can and reads it again), and a real test text through the delivery path to a follower inside the 48 hours.
 */
export const ZaloConnectionChecks = (props: ZaloConnectionChecksProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const { lines } = useZaloChecks(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    const sender = useZaloTestSend(props.connectionId)
    const setup = useZaloSetupStep(props.connectionId, "check")
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloConnectionChecksBase
            props={{
                step: setup.step,
                title: t("checksTitle"),
                lines,
                slotLabels: slotLabels(t("checksEmpty")),
                markLabels: { ok: t("markOk"), fail: t("markFail"), warn: t("markWarn") },
                sendView: sender.view,
                sendLabels: slotLabels(t("testEmpty")),
                send: {
                    title: t("testTitle"),
                    hint: t("testHint"),
                    recipientLabel: t("testRecipient"),
                    recipientEmpty: t("testRecipientEmpty"),
                    recipientId: sender.recipientId,
                    textLabel: t("testText"),
                    text: sender.text,
                    sendLabel: t("testSend"),
                    isSending: sender.isSending,
                    note: sender.note,
                    noteTone: sender.isNoteOk ? "affirmative" : "negative",
                },
            }}
            on={{
                retry: reload,
                toggle: setup.toggle,
                pickRecipient: sender.setRecipient,
                changeText: sender.setText,
                send: () => void sender.send(),
            }}
        />
    )
}
