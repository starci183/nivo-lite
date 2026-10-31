"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloOverviewFacts, useZaloPage, useZaloSetupFacts } from "@/hooks/zaloConnection"
import { ZaloConnectionFactsBase } from "./component"

/** What the page hands the facts: the connection of the url and which set it draws. */
interface ZaloConnectionFactsProps {
    readonly connectionId: string
    /** `tiles`: the health band under the page header; `saved`: what the first setup step stored, secrets masked. */
    readonly kind: "tiles" | "saved"
}

/** The connected facts: the health of the OA at a glance, or what is saved with every secret masked to its last four characters. */
export const ZaloConnectionFacts = (props: ZaloConnectionFactsProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const tiles = useZaloOverviewFacts(props.connectionId)
    const saved = useZaloSetupFacts(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    return (
        <ZaloConnectionFactsBase
            shape={props.kind}
            props={{ facts: props.kind === "tiles" ? tiles : saved, slotLabels: slotLabels(t("factsEmpty")) }}
            on={{ retry: reload }}
        />
    )
}
