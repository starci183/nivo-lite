"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { rowHrefOf } from "@/hooks/connectionsPanes"
import { useWorkspaceId } from "@/hooks/workspaces"
import { lifecycleChipOf, lifecycleOf } from "@/modules/connection-lifecycle"
import type { Connection, LibraryCard } from "@/modules/types"

/** Where a connector's tile stands: its status in the shared vocabulary and, when a connection needs the owner, the command to it. */
interface LibraryLife {
    readonly status: LibraryCard["status"]
    readonly lifeAction?: LibraryCard["lifeAction"]
}

/** Which step of the life a tile reports first: a failure, then an unfinished setup, then a disconnected connection. */
const RANK: Readonly<Record<string, number>> = { attention: 0, setup: 1, waiting: 1, disconnected: 3 }

/** The tile command of each step of the life; continuing the setup is the default. */
const ACTION_KEY: Readonly<Record<string, string>> = { attention: "libFix", disconnected: "libReconnect" }

/**
 * The status of a connector's tile in the one vocabulary of the Connections screens, from the workspace's connections of it: the one
 * that needs the owner most (Needs action → Fix, Setting up n/4 or Waiting → Continue, Disconnected → Reconnect), else how many run,
 * else Not connected. `null` when nothing needs the owner, so the tile keeps its own connect or add command.
 */
export const useLibraryLife = (): ((mine: ReadonlyArray<Connection>, unit: string) => LibraryLife) => {
    const t = useTranslations("connections")
    const workspaceId = useWorkspaceId()
    return useCallback(
        (mine: ReadonlyArray<Connection>, unit: string): LibraryLife => {
            const ranked = mine
                .map((connection) => ({ connection, life: lifecycleOf(connection) }))
                .filter((item) => item.life.id in RANK)
                .sort((a, b) => (RANK[a.life.id] ?? 9) - (RANK[b.life.id] ?? 9))
            const live = mine.filter((connection) => connection.status !== "disconnected").length
            const first = ranked[0]
            const translate = (key: string, values?: Record<string, string | number>) => t(key, values)
            if (first !== undefined && (first.life.id !== "disconnected" || live === 0)) {
                const chip = lifecycleChipOf(first.life, translate)
                const labelKey = ACTION_KEY[first.life.id] ?? "libContinue"
                return {
                    status: {
                        label: chip.label,
                        tone: chip.tone === "neutral" ? "muted" : chip.tone,
                        isDot: chip.isDot,
                    },
                    lifeAction: { label: t(labelKey), href: rowHrefOf(first.connection, workspaceId) },
                }
            }
            if (live > 0) return { status: { tone: "success", label: t(`unit_${unit}`, { count: live }), isDot: true } }
            return { status: { tone: "muted", label: t("life_unconnected"), isDot: false } }
        },
        [t, workspaceId],
    )
}
