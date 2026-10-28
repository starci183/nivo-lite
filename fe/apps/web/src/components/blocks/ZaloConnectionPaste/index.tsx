"use client"

import { useTranslations } from "next-intl"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloPage, useZaloPaste } from "@/hooks/zaloConnection"
import { ZaloConnectionPasteBase } from "./component"

/** What the page hands the card: the connection of the url. */
interface ZaloConnectionPasteProps {
    readonly connectionId: string
}

/** The connected card of the addresses to paste into the Zalo app, built from the app's public url configuration. */
export const ZaloConnectionPaste = (props: ZaloConnectionPasteProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const copyLabels = useCopyLabels()
    const paste = useZaloPaste(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    return (
        <ZaloConnectionPasteBase
            props={{
                title: t("pasteTitle"),
                callbackLabel: t("pasteCallback"),
                webhookLabel: t("pasteWebhook"),
                paste,
                slotLabels: slotLabels(t("pasteEmpty")),
                copyLabels,
            }}
            on={{ retry: reload }}
        />
    )
}
