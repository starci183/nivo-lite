"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useConnectionOpenPage } from "@/hooks/connectionsPanes"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { ConnectionOpenFactsBase } from "./component"

/** The connected details card of a connection without a page of its own. */
export const ConnectionOpenFacts = () => {
    const t = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const open = useConnectionOpenPage()
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ConnectionOpenFactsBase
            props={{
                title: t("factsTitle"),
                facts: mapSlot(open.slot, () => open.facts),
                slotLabels: slotLabels(t("connectedEmpty")),
            }}
            on={{ retry: open.retry }}
        />
    )
}
