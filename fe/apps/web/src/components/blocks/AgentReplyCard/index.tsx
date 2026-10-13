"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSave } from "@/hooks/modules"
import { setHoldingMessage, setReplyTimeout } from "@/lib/module-settings-actions"
import { AgentReplyCardBase } from "./component"

/** The chatbot the card sets, with the values it holds now. */
type AgentReplyCardProps = {
    readonly installationId: string
    /** The longest a customer waits before the app answers directly, in seconds. */
    readonly timeoutSec: number
    readonly holdingMessage: string
}

const TIMEOUT_MIN = 5
const TIMEOUT_MAX = 120
const TIMEOUT_DIGITS = 3
const HOLDING_MAX = 400

/** The connected reply card of a chatbot: each of its two settings saves on its own. */
export const AgentReplyCard = (props: AgentReplyCardProps) => {
    const t = useTranslations("modulesCore")
    const [timeoutText, setTimeoutText] = useState(String(props.timeoutSec))
    const [holding, setHolding] = useState(props.holdingMessage)
    const { note, isPending, save } = useSave()
    const timeout = Number(timeoutText)
    return (
        <AgentReplyCardBase
            props={{
                title: t("replyTitle"),
                timeoutLabel: t("timeoutLabel"),
                timeoutHint: t("timeoutHint"),
                timeout: timeoutText,
                canSaveTimeout:
                    Number.isInteger(timeout) &&
                    timeout >= TIMEOUT_MIN &&
                    timeout <= TIMEOUT_MAX &&
                    timeout !== props.timeoutSec,
                holdingLabel: t("holdingLabel"),
                holdingHint: t("holdingHint"),
                holdingPlaceholder: t("holdingDefault"),
                holding,
                canSaveHolding: holding.trim() !== props.holdingMessage.trim(),
                saveLabel: t("timeoutSave"),
                isPending,
                noteTone: note.tone,
                noteTitle: note.tone === "saved" ? t("saved") : t("notSaved"),
                noteText: note.text,
            }}
            on={{
                timeout: (value) => setTimeoutText(value.replace(/[^0-9]/gu, "").slice(0, TIMEOUT_DIGITS)),
                holding: (value) => setHolding(value.slice(0, HOLDING_MAX)),
                saveTimeout: () => save(() => setReplyTimeout(props.installationId, timeout), t("saved")),
                saveHolding: () => save(() => setHoldingMessage(props.installationId, holding), t("saved")),
            }}
        />
    )
}
