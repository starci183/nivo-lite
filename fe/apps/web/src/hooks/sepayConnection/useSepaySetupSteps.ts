"use client"

import { useTranslations } from "next-intl"
import { PROVIDERS } from "@/hooks/connection-providers"
import type { SepayStepId } from "@/modules/types"
import { SEPAY_STEP_IDS } from "./sepayConnection.shared"
import { useSepayConnection } from "./useSepayConnection"
import { useSepaySteps } from "./useSepaySteps"

const TITLE_KEYS = {
    environment: "stepEnvironment",
    account: "stepAccount",
    paste: "stepPaste",
    test: "stepTest",
    agents: "stepAgents",
} as const satisfies Readonly<Record<SepayStepId, string>>

type UseSepaySetupStepsResult = {
    stepsLabel: string
    steps: {
        ordinal: number
        title: string
        hint: string
        id: SepayStepId
        summary: string
        isOpen: boolean
        isDone: boolean
    }[]
    openSepay: {
        label: string
        href: string
    }
    toggle: (id: SepayStepId, isOpen: boolean) => void
}

/**
 * The setup steps of a SePay connection in the words of the reader: each one's place, title, guidance, summary and whether it is open,
 * the way to the SePay dashboard of the environment, and the command that opens or closes a step.
 */
export const useSepaySetupSteps = (connectionId: string): UseSepaySetupStepsResult => {
    const t = useTranslations("sepayConnection")
    const { slot } = useSepayConnection(connectionId)
    const { steps, toggle } = useSepaySteps(connectionId)
    const environment = ("items" in slot ? slot.items : undefined)?.environment ?? "test"
    const titleOf = (id: SepayStepId): string => {
        if (id === "test") return t(environment === "live" ? "checklistTitleLive" : "checklistTitle")
        return t(TITLE_KEYS[id])
    }
    const drawn =
        steps.length === 0
            ? SEPAY_STEP_IDS.map((id) => ({ id, summary: "", isOpen: false, isDone: false }))
            : steps.map((step) => ({ id: step.id, summary: step.summary, isOpen: step.isOpen, isDone: step.isDone }))
    const dashboard = PROVIDERS.sepay.dashboard
    return {
        stepsLabel: t("stepsLabel"),
        steps: drawn.map((step, index) => ({
            ...step,
            ordinal: index + 1,
            title: titleOf(step.id),
            hint: t(`${TITLE_KEYS[step.id]}Hint`),
        })),
        openSepay: {
            label: t("openSepay"),
            href: (environment === "test" ? dashboard.test : dashboard.live) ?? dashboard.live ?? "",
        },
        toggle,
    }
}
