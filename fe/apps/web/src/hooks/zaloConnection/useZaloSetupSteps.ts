"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { PROVIDERS } from "@/hooks/connection-providers"
import type { ZaloStepId } from "@/modules/types"
import { useZaloHead } from "./useZaloHead"
import { useZaloPage } from "./useZaloPage"
import { useZaloSteps } from "./useZaloSteps"

const TITLE_KEYS = {
    app: "stepApp",
    paste: "stepPaste",
    authorize: "stepAuthorize",
    check: "stepCheck",
    agents: "stepAgents",
} as const satisfies Readonly<Record<ZaloStepId, string>>

/**
 * The setup steps of a Zalo OA connection in the words of the reader: each one's place, title, guidance, summary and whether it is
 * open, the commands of steps 2 and 3, and the command that opens or closes a step.
 */
export const useZaloSetupSteps = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const { steps, toggle } = useZaloSteps(connectionId)
    const { reconnect, notice, isOwner } = useZaloHead(connectionId)
    const { slot } = useZaloPage(connectionId)
    const [isAuthorizing, setAuthorizing] = useState(false)
    const isAuthorized = steps.find((step) => step.id === "authorize")?.isDone === true
    const hintOf = (id: ZaloStepId): string => {
        if (id === "authorize") {
            if (isAuthorized) return t("stepAuthorizeHintDone")
            return isOwner ? t("stepAuthorizeHint") : t("stepAuthorizeHintAsk")
        }
        return t(`${TITLE_KEYS[id]}Hint`)
    }
    return {
        stepsLabel: t("stepsLabel"),
        steps: steps.map((step, index) => ({
            id: step.id,
            ordinal: index + 1,
            title: t(TITLE_KEYS[step.id]),
            summary: step.summary,
            hint: hintOf(step.id),
            isOpen: step.isOpen,
        })),
        authorizeNotice: notice,
        openZalo: { label: t("openZalo"), href: PROVIDERS.zalo_oa.dashboard.live ?? "" },
        /** Sends the owner to Zalo to grant the OA; absent for everyone else, whom the back end refuses. */
        authorize:
            isOwner && ("items" in slot ? slot.items : undefined) !== undefined
                ? {
                      label: isAuthorized ? t("reconnect") : t("authorize"),
                      isPending: isAuthorizing,
                      isNext: !isAuthorized,
                  }
                : undefined,
        runAuthorize: () => {
            setAuthorizing(true)
            void reconnect().then(() => setAuthorizing(false))
        },
        toggle,
    }
}
