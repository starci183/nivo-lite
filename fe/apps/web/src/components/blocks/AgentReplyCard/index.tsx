"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    HOLDING_MAX,
    REPLY_TIMEOUT_MAX,
    REPLY_TIMEOUT_MIN,
    useAgentInstallation,
    useAgentRights,
    useSaveReply,
} from "@/hooks/agentSettings"
import { AgentReplyCardBase } from "./component"

/** The chatbot the card sets. */
type AgentReplyCardProps = {
    readonly installationId: string
    readonly module: string
}

const TIMEOUT_DIGITS = 3

/** The connected reply card of a chatbot: each of its two settings saves on its own. Only owners and managers see it. */
export const AgentReplyCard = (props: AgentReplyCardProps) => {
    const t = useTranslations("modulesCore")
    const { canEdit } = useAgentRights()
    const { slot } = useAgentInstallation(props.installationId, props.module)
    const [timeoutDraft, setTimeoutDraft] = useState<string | null>(null)
    const [holdingDraft, setHoldingDraft] = useState<string | null>(null)
    const { timeout: saveTimeout, holding: saveHolding, isSaving } = useSaveReply(props.installationId)
    const savedTimeout = slot.items?.timeoutSec ?? 0
    const savedHolding = slot.items?.holdingMessage ?? ""
    const timeoutText = timeoutDraft ?? String(savedTimeout)
    const holding = holdingDraft ?? savedHolding
    const timeout = Number(timeoutText)
    const submitTimeout = async () => {
        if (await saveTimeout(timeout)) setTimeoutDraft(null)
    }
    const submitHolding = async () => {
        if (await saveHolding(holding)) setHoldingDraft(null)
    }
    if (!canEdit || slot.items === undefined) return null
    return (
        <AgentReplyCardBase
            props={{
                title: t("replyTitle"),
                timeoutLabel: t("timeoutLabel"),
                timeoutHint: t("timeoutHint"),
                timeout: timeoutText,
                canSaveTimeout:
                    Number.isInteger(timeout) &&
                    timeout >= REPLY_TIMEOUT_MIN &&
                    timeout <= REPLY_TIMEOUT_MAX &&
                    timeout !== savedTimeout,
                holdingLabel: t("holdingLabel"),
                holdingHint: t("holdingHint"),
                holdingPlaceholder: t("holdingDefault"),
                holding,
                canSaveHolding: holding.trim() !== savedHolding.trim(),
                saveLabel: t("timeoutSave"),
                isPending: isSaving,
            }}
            on={{
                timeout: (value) => setTimeoutDraft(value.replace(/[^0-9]/gu, "").slice(0, TIMEOUT_DIGITS)),
                holding: (value) => setHoldingDraft(value.slice(0, HOLDING_MAX)),
                saveTimeout: () => void submitTimeout(),
                saveHolding: () => void submitHolding(),
            }}
        />
    )
}
