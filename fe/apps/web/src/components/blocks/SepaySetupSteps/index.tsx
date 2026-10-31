"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { PROVIDERS } from "@/hooks/connection-providers"
import { SEPAY_STEP_IDS, useSepayConnection, useSepaySteps } from "@/hooks/sepayConnection"
import type { SepayStepId } from "@/modules/types"
import { SepaySetupStepsBase } from "./component"

/** What the page hands the steps: the connection of the url and the connected body of every step. */
interface SepaySetupStepsProps {
    readonly connectionId: string
    readonly shape: Readonly<Record<SepayStepId, ReactNode>>
}

const TITLE_KEYS = {
    environment: "stepEnvironment",
    account: "stepAccount",
    paste: "stepPaste",
    test: "stepTest",
    agents: "stepAgents",
} as const satisfies Readonly<Record<SepayStepId, string>>

/** The connected setup steps of a SePay connection: done or not from the connection read, the first one not done opens. */
export const SepaySetupSteps = (props: SepaySetupStepsProps) => {
    const t = useTranslations("sepayConnection")
    const { slot } = useSepayConnection(props.connectionId)
    const { steps, toggle } = useSepaySteps(props.connectionId)
    const environment = slot.items?.environment ?? "test"
    const titleOf = (id: SepayStepId): string => {
        if (id === "test") return t(environment === "live" ? "checklistTitleLive" : "checklistTitle")
        return t(TITLE_KEYS[id])
    }
    const drawn =
        steps.length === 0
            ? SEPAY_STEP_IDS.map((id) => ({ id, summary: "", isOpen: false }))
            : steps.map((step) => ({ id: step.id, summary: step.summary, isOpen: step.isOpen }))
    const dashboard = PROVIDERS.sepay.dashboard
    return (
        <SepaySetupStepsBase
            shape={props.shape}
            props={{
                steps: drawn.map((step) => ({
                    ...step,
                    title: titleOf(step.id),
                    hint: t(`${TITLE_KEYS[step.id]}Hint`),
                })),
                openSepay: {
                    label: t("openSepay"),
                    href: (environment === "test" ? dashboard.test : dashboard.live) ?? dashboard.live ?? "",
                },
            }}
            on={{ toggle }}
        />
    )
}
