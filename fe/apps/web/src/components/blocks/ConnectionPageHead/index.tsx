"use client"

import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { useDrivePageHead } from "@/hooks/drive"
import { useTelegramPageHead } from "@/hooks/telegramConnection"
import { ConnectionPageHeadBase } from "./component"

/** The bands the page hands the frame: the connected bands of its two panes. */
interface ConnectionPageHeadShape {
    readonly main: ReactNode
    readonly rail: ReactNode
}

/**
 * Which provider the frame serves: the Telegram bot of the url, or the workspace's Google Drive grant (one per workspace, so no id).
 * The hooks of both run on every render, as hooks must, and the one that serves another provider reads nothing.
 */
type ConnectionPageHeadProps =
    | { readonly kind: "telegram"; readonly connectionId: string; readonly shape: ConnectionPageHeadShape }
    | { readonly kind: "drive"; readonly shape: ConnectionPageHeadShape }

/**
 * The connected frame of a provider connection page: the header with its one command, the notices, the main pane, the live rail and
 * the owner's disconnect, which asks first. An id that is no Telegram connection of the workspace is `notFound()` once.
 */
export const ConnectionPageHead = (props: ConnectionPageHeadProps) => {
    const telegram = useTelegramPageHead(props.kind === "telegram" ? props.connectionId : undefined)
    const drive = useDrivePageHead(props.kind === "drive")
    if (props.kind === "telegram" && telegram.isMissing) notFound()
    const { view, on } = props.kind === "telegram" ? telegram : drive
    return (
        <ConnectionPageHeadBase shape={props.shape} props={view} on={on} />
    )
}
