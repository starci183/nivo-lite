"use client"

import { useMemo } from "react"
import { adminWorkspacePath } from "@/modules/routes"
import { billingTone, healthTone, moduleTone } from "./admin.shared"
import type { AdminBadgeView, AdminFormat, AdminText, AdminWorkspaceItem, AdminWorkspaceRowView } from "./admin.shared"
import { useAdminFormat } from "./useAdminFormat"

const warningOf = (provider: string, error: number, silent: number, text: AdminText): AdminBadgeView => ({
    id: `warn-${provider}`,
    tone: healthTone(error > 0 ? "error" : "silent"),
    label: text("connectionWarning", {
        provider,
        parts: [
            error > 0 ? text("connectionErrors", { count: error }) : "",
            silent > 0 ? text("connectionSilent", { count: silent }) : "",
        ]
            .filter((part) => part !== "")
            .join(", "),
    }),
})

/** Words and formats the workspaces the back end returned into table rows. */
const workspaceRows = (
    items: ReadonlyArray<AdminWorkspaceItem>,
    format: AdminFormat,
    text: AdminText,
): ReadonlyArray<AdminWorkspaceRowView> =>
    items.map((item) => ({
        id: item.id,
        name: item.name,
        href: adminWorkspacePath(item.id),
        needsAttention: item.attention,
        ownerEmail: item.ownerEmail ?? text("empty"),
        status: item.status,
        statusTone: billingTone(item.status),
        paidUntil: typeof item.paidUntil === "string" ? text("paidUntil", { date: format.date(item.paidUntil) }) : null,
        plan: item.planCode ?? text("empty"),
        created: format.date(item.createdAt),
        members: item.members,
        modules: item.modules.map((entry) => ({
            id: entry.key,
            tone: moduleTone(entry.status),
            isDot: entry.live,
            label: text("moduleBadge", { key: entry.key, status: entry.status }),
        })),
        connections: item.connections.map((entry) => ({
            id: entry.provider,
            tone: "neutral",
            label: text("connectionBadge", { provider: entry.provider, count: entry.count }),
        })),
        connectionWarnings: item.connections
            .filter((entry) => entry.error + entry.silent > 0)
            .map((entry) => warningOf(entry.provider, entry.error, entry.silent, text)),
        lastMessage: format.ago(item.lastCustomerMessageAt),
        messages7d: item.messages7d,
        openDecisions: item.openDecisions,
    }))

/** The workspaces of the list worded and formatted into table rows in the reader's locale. */
export const useAdminWorkspaceRows = (
    source: ReadonlyArray<AdminWorkspaceItem> | undefined,
): ReadonlyArray<AdminWorkspaceRowView> | undefined => {
    const { text, format } = useAdminFormat()
    return useMemo(
        () => (source === undefined ? undefined : workspaceRows(source, format, text)),
        [source, format, text],
    )
}
