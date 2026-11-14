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

/**
 * The connected overview of a Zalo OA connection: the connection's facts. The setup's phases are the steps card of the same tab
 * (one stepper per page), so no second setup card is drawn here.
 */
export const ZaloConnectionFacts = (props: ZaloConnectionFactsProps) => {
    const t = useTranslations("zaloConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const overview = useZaloOverviewFacts(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloConnectionFactsBase
            props={{
                title: tc("factsTitle"),
                facts: overview,
                slotLabels: slotLabels(t("factsEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}
