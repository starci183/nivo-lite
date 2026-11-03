"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloPage, useZaloSetupFacts, useZaloSetupStep } from "@/hooks/zaloConnection"
import { ZaloAppStepBase } from "./component"

/** What the page hands the step: the connection of the url. */
interface ZaloAppStepProps {
    readonly connectionId: string
}

/** The connected first setup step: what is saved with every secret masked to its last four characters. */
export const ZaloAppStep = (props: ZaloAppStepProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const saved = useZaloSetupFacts(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    const setup = useZaloSetupStep(props.connectionId, "app")
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloAppStepBase
            props={{ step: setup.step, facts: saved, slotLabels: slotLabels(t("factsEmpty")) }}
            on={{ retry: reload, toggle: setup.toggle }}
        />
    )
}
