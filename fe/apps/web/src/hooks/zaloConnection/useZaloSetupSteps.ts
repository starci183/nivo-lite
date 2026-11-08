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

type UseZaloSetupStepsResult = {
    stepsLabel: string
    steps: {
        id: ZaloStepId
        ordinal: number
        title: string
        summary: string
        hint: string
        isOpen: boolean
        isDone: boolean
        isProblem: boolean
    }[]
    authorizeNotice: string
    openZalo: {
        label: string
        href: string
    }
    /** Sends the owner to Zalo to grant the OA; absent for everyone else, whom the back end refuses. */
    authorize:
        | {
              label: string
              isPending: boolean
              isNext: boolean
          }
        | undefined
    runAuthorize: () => void
    toggle: (id: ZaloStepId, isOpen: boolean) => void
}

/**
 * The setup steps of a Zalo OA connection in the words of the reader: each one's place, title, guidance, summary and whether it is
 * open, the commands of steps 2 and 3, and the command that opens or closes a step.
 */
export const useZaloSetupSteps = (connectionId: string): UseZaloSetupStepsResult => {
    const t = useTranslations("zaloConnection")
    const { steps, toggle } = useZaloSteps(connectionId)
    const { reconnect, notice, isOwner } = useZaloHead(connectionId)
    const { slot } = useZaloPage(connectionId)
    const [isAuthorizing, setIsAuthorizing] = useState(false)
    const isAuthorized = steps.find((step) => step.id === "authorize")?.isDone === true
    const hintOf = (id: ZaloStepId): string => {
        if (id === "authorize") {
            if (isAuthorized) return t("stepAuthorizeHintDone")
            return isOwner ? t("stepAuthorizeHint") : t("stepAuthorizeHintAsk")
        }
        return t(`${TITLE_KEYS[id]}Hint`)
    }
    const hasItems = "items" in slot
    const authorizeLabel = isAuthorized ? t("reconnect") : t("authorize")
    return {
        stepsLabel: t("stepsLabel"),
        steps: steps.map((step, index) => ({
            id: step.id,
            ordinal: index + 1,
            title: t(TITLE_KEYS[step.id]),
            summary: step.summary,
            hint: hintOf(step.id),
            isOpen: step.isOpen,
            isDone: step.isDone,
            isProblem: step.isProblem,
        })),
        authorizeNotice: notice,
        openZalo: { label: t("openZalo"), href: PROVIDERS.zalo_oa.dashboard.live ?? "" },
        /** Sends the owner to Zalo to grant the OA; absent for everyone else, whom the back end refuses. */
        authorize:
            isOwner && hasItems
                ? {
                      label: authorizeLabel,
                      isPending: isAuthorizing,
                      isNext: !isAuthorized,
                  }
                : undefined,
        runAuthorize: (): void => {
            setIsAuthorizing(true)
            void reconnect().then(() => setIsAuthorizing(false))
        },
        toggle,
    }
}
