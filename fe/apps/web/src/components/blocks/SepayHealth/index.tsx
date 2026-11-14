"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSepayConnection, useSepayFacts } from "@/hooks/sepayConnection"
import { useSlotLabels } from "@/hooks/slot"
import { SepayHealthBase } from "./component"

/** What the page hands the overview: the connection of the url. */
type SepayHealthProps = { readonly connectionId: string }

/**
 * The connected overview of a SePay connection: the connection's facts. The setup's phases are the steps card of the same tab (one
 * stepper per page), so no second setup card is drawn here.
 */
export const SepayHealth = (props: SepayHealthProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const facts = useSepayFacts(props.connectionId)
    const { retry } = useSepayConnection(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepayHealthBase
            props={{
                title: t("healthTitle"),
                facts,
                slotLabels: slotLabels(t("loadFailed")),
            }}
            on={{ retry }}
        />
    )
}
