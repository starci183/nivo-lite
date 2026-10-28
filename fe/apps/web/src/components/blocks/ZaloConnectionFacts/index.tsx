"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloOverviewFacts, useZaloPage, useZaloSetupFacts } from "@/hooks/zaloConnection"
import { ZaloConnectionFactsBase } from "./component"

/** What the page hands the card: the connection of the url and which tab asked. */
interface ZaloConnectionFactsProps {
    readonly connectionId: string
    readonly kind: "overview" | "setup"
}

/** The connected facts card: the state of the OA at a glance, or what is saved with every secret masked to its last four characters. */
export const ZaloConnectionFacts = (props: ZaloConnectionFactsProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const overview = useZaloOverviewFacts(props.connectionId)
    const setup = useZaloSetupFacts(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    const isOverview = props.kind === "overview"
    return (
        <ZaloConnectionFactsBase
            props={{
                title: isOverview ? t("overviewTitle") : t("setupTitle"),
                hint: isOverview ? t("overviewHint") : t("setupHint"),
                facts: isOverview ? overview : setup,
                slotLabels: slotLabels(t("factsEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}
