"use client"

import { useTranslations } from "next-intl"
import { useConnectionOpenPage } from "@/hooks/connectionsPanes"
import { useSlotLabels } from "@/hooks/slot"
import { ConnectionOpenContentBase } from "./component"

/** The connected content of a connection without a page of its own: the row's alerts, notes, SMTP panel and keys, from the band's read. */
export const ConnectionOpenContent = () => {
    const t = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const open = useConnectionOpenPage()
    return (
        <ConnectionOpenContentBase
            props={{ slot: open.slot, placeholder: open.placeholder, slotLabels: slotLabels(t("connectedEmpty")) }}
            on={{ ...open.on, retry: open.retry }}
        />
    )
}
