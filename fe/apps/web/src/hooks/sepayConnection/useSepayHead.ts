"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { lifecycleChipOf } from "@/modules/connection-lifecycle"
import type { ConnectionLifecycle, ConnectionLifecycleChip, SepayConnectionView } from "@/modules/types"
import { sepayLifecycleOf } from "./sepayConnection.shared"
import { useSepayCommands } from "./useSepayCommands"
import { useSepayConnection } from "./useSepayConnection"

/** Which command each step of the life needs: fix a failing connection, continue an unfinished setup, connect again. */
export type SepayHeadCommand = "fix" | "settings" | "reconnect"

const commandOf = (life: ConnectionLifecycle | null): SepayHeadCommand | null => {
    if (life === null || life.id === "running") return null
    if (life.id === "attention") return "fix"
    return life.id === "disconnected" ? "reconnect" : "settings"
}

/** What the band of a SePay connection page reads and does. */
interface SepayHead {
    /** The connection once read; undefined while it is read. */
    readonly connection: SepayConnectionView | undefined
    /** Where the connection stands in the shared life; null while the page is read. */
    readonly life: ConnectionLifecycle | null
    /** How many agents work through the connection; undefined while the page is read. */
    readonly agentCount: number | undefined
    /** The command the status needs; null when none. */
    readonly command: SepayHeadCommand | null
    /** The status in the shared vocabulary, then the environment badge while it is a test; empty while the page is read. */
    readonly chips: ReadonlyArray<ConnectionLifecycleChip>
    readonly isMissing: boolean
    readonly isOwner: boolean
    readonly isDisconnecting: boolean
    /** Disconnects the connection (owner only); resolves true once it is done. */
    readonly disconnect: () => Promise<boolean>
}

/** The band of the page of a SePay connection: the connection read, its place in the shared life, and the owner disconnect. */
export const useSepayHead = (connectionId: string): SepayHead => {
    const tc = useTranslations("connections")
    const { slot, isMissing } = useSepayConnection(connectionId)
    const commands = useSepayCommands(connectionId)
    const { role } = useConnectionsRole()
    const [isDisconnecting, setDisconnecting] = useState(false)
    const connection = "items" in slot ? slot.items : undefined
    const disconnect = useCallback(async (): Promise<boolean> => {
        setDisconnecting(true)
        const settled = await commands.disconnect()
        setDisconnecting(false)
        return settled.kind === "ok"
    }, [commands])
    const life = connection === undefined ? null : sepayLifecycleOf(connection)
    return {
        connection,
        life,
        command: commandOf(life),
        chips:
            life === null
                ? []
                : [
                      lifecycleChipOf(life, (key, values) => tc(key, values)),
                      ...(connection?.environment === "test" && life.id !== "disconnected"
                          ? [{ label: tc("envBadgeTest"), tone: "warning" as const, isDot: false }]
                          : []),
                  ],
        agentCount: connection?.agentIds.length,
        isMissing,
        isOwner: role === "owner",
        isDisconnecting,
        disconnect,
    }
}
