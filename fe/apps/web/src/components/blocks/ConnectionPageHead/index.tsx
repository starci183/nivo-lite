"use client"

import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionRefusal } from "@/hooks/connections"
import { useDrivePageHead, useDriveRail } from "@/hooks/drive"
import { useSlotLabels } from "@/hooks/slot"
import { useTelegramPageHead, useTelegramRail } from "@/hooks/telegramConnection"
import { ConnectionPageHeadBase } from "./component"

/**
 * Which provider the frame serves: the Telegram bot of the url, or the workspace's Google Drive grant (one per workspace, so no id).
 * The hooks of both run on every render, as hooks must, and the one that serves another provider reads nothing.
 */
type ConnectionPageHeadProps = (
    { readonly kind: "telegram"; readonly connectionId: string } | { readonly kind: "drive" }
) & { readonly children: ReactNode }

/**
 * The connected frame of a provider connection page: the header with its one command, the notices, the main pane, the live rail and
 * the owner's disconnect, which asks first. An id that is no Telegram connection of the workspace is `notFound()` once.
 */
export const ConnectionPageHead = (props: ConnectionPageHeadProps) => {
    const telegram = useTelegramPageHead(props.kind === "telegram" ? props.connectionId : undefined)
    const drive = useDrivePageHead(props.kind === "drive")
    const refusal = useConnectionRefusal()
    const slotLabels = useSlotLabels()
    const telegramRail = useTelegramRail(props.kind === "telegram" ? props.connectionId : undefined)
    const driveRail = useDriveRail(props.kind === "drive")
    const rail = props.kind === "telegram" ? telegramRail : driveRail
    if (props.kind === "telegram" && telegram.isMissing && refusal === undefined) notFound()
    const { view, on } = props.kind === "telegram" ? telegram : drive
    return (
        <ConnectionPageHeadBase
            children={props.children}
            props={{
                ...view,
                markSrc: PROVIDER_LOGO[props.kind === "telegram" ? "telegram" : "google_drive"] ?? "",
                ...(refusal === undefined ? {} : { refusal }),
                events: {
                    title: rail.title,
                    liveLabel: rail.liveLabel,
                    footnote: rail.footnote,
                    lines: rail.lines,
                    slotLabels: slotLabels(rail.emptyLabel),
                },
            }}
            on={{ ...on, retryEvents: rail.retry }}
        />
    )
}
