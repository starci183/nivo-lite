"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloOverviewFacts, useZaloPage } from "@/hooks/zaloConnection"
import { ZaloConnectionFactsBase } from "./component"

/** What the page hands the facts: the connection of the url. */
interface ZaloConnectionFactsProps {
    readonly connectionId: string
}

/** The connected health tiles: the health of the OA at a glance. */
export const ZaloConnectionFacts = (props: ZaloConnectionFactsProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const tiles = useZaloOverviewFacts(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloConnectionFactsBase
            props={{ label: t("mainLabel"), facts: tiles, slotLabels: slotLabels(t("factsEmpty")) }}
            on={{ retry: reload }}
        />
    )
}
