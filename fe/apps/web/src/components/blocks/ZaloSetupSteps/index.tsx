"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ReactNode } from "react"
import { PROVIDERS } from "@/hooks/connection-providers"
import { useZaloHead, useZaloPage, useZaloSteps } from "@/hooks/zaloConnection"
import type { ZaloStepId } from "@/modules/types"
import { ZaloSetupStepsBase } from "./component"

/** What the page hands the steps: the connection of the url and the connected body of every step but the authorization. */
interface ZaloSetupStepsProps {
    readonly connectionId: string
    readonly shape: Readonly<Record<Exclude<ZaloStepId, "authorize">, ReactNode>>
}

const TITLE_KEYS = {
    app: "stepApp",
    paste: "stepPaste",
    authorize: "stepAuthorize",
    check: "stepCheck",
    agents: "stepAgents",
} as const satisfies Readonly<Record<ZaloStepId, string>>

/** The connected setup steps: done or not from the page read, the first one not done opens, step 3 sends the owner to Zalo. */
export const ZaloSetupSteps = (props: ZaloSetupStepsProps) => {
    const t = useTranslations("zaloConnection")
    const { steps, toggle } = useZaloSteps(props.connectionId)
    const { reconnect, notice, isOwner } = useZaloHead(props.connectionId)
    const { slot } = useZaloPage(props.connectionId)
    const [isAuthorizing, setAuthorizing] = useState(false)
    const isAuthorized = steps.find((step) => step.id === "authorize")?.isDone === true
    const hintOf = (id: ZaloStepId): string => {
        if (id === "authorize") {
            if (isAuthorized) return t("stepAuthorizeHintDone")
            return isOwner ? t("stepAuthorizeHint") : t("stepAuthorizeHintAsk")
        }
        return t(`${TITLE_KEYS[id]}Hint`)
    }
    return (
        <ZaloSetupStepsBase
            shape={props.shape}
            props={{
                stepsLabel: t("stepsLabel"),
                steps: steps.map((step) => ({
                    id: step.id,
                    title: t(TITLE_KEYS[step.id]),
                    summary: step.summary,
                    hint: hintOf(step.id),
                    isOpen: step.isOpen,
                })),
                authorizeNotice: notice,
                commands: {
                    openZalo: { label: t("openZalo"), href: PROVIDERS.zalo_oa.dashboard.live ?? "" },
                    ...(isOwner && slot.items !== undefined
                        ? {
                              authorize: {
                                  label: isAuthorized ? t("reconnect") : t("authorize"),
                                  isPending: isAuthorizing,
                                  isNext: !isAuthorized,
                              },
                          }
                        : {}),
                },
            }}
            on={{
                toggle,
                authorize: () => {
                    setAuthorizing(true)
                    void reconnect().then(() => setAuthorizing(false))
                },
            }}
        />
    )
}
