"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useZaloChecks, useZaloPage } from "@/hooks/zaloConnection"
import { ZaloConnectionEventsBase } from "./component"

/** The connection of the url. */
interface ZaloConnectionEventsProps {
    readonly connectionId: string
}

/**
 * The connected live rail of a Zalo OA connection. The back end reports no message feed for an OA, so the rail shows what it does
 * report, read again every few seconds: each part of the OA (app, token, webhook, permissions) with its verdict and when it was seen.
 */
export const ZaloConnectionEvents = (props: ZaloConnectionEventsProps) => {
    const t = useTranslations("zaloConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const { lines } = useZaloChecks(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloConnectionEventsBase
            props={{
                title: t("checksTitle"),
                liveLabel: tc("eventsLive"),
                emptyMessage: tc("eventsEmpty"),
                emptyHint: tc("eventsEmptyHint"),
                lines: mapSlot(lines, (rows) =>
                    rows.map((row) => ({
                        id: row.key,
                        title: row.title,
                        description: row.detail,
                        ...(row.mark === "warn"
                            ? {}
                            : { verdict: row.mark === "ok" ? ("success" as const) : ("danger" as const) }),
                    })),
                ),
                slotLabels: slotLabels(tc("eventsEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}
