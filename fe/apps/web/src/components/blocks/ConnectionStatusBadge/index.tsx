"use client"

import { useTranslations } from "next-intl"
import { statusKey, statusTone } from "@/hooks/connections"
import type { ConnectionStatus } from "@/modules/types"
import { ConnectionStatusBadgeBase } from "./component"

/** What the surface that lists connections hands the badge. */
type ConnectionStatusBadgeProps = {
    readonly status: ConnectionStatus
}

/** One status chip for a connection: connected, needs attention, unfinished or disconnected. */
export const ConnectionStatusBadge = (props: ConnectionStatusBadgeProps) => {
    const t = useTranslations("connections")
    return <ConnectionStatusBadgeBase props={{ label: t(statusKey(props.status)), tone: statusTone(props.status) }} />
}
