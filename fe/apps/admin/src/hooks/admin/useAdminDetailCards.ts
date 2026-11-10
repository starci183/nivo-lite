"use client"

import { useMemo } from "react"
import { adminCard, badgeOf, flowTone, healthTone, moduleTone } from "./admin.shared"
import type {
    AdminBadgeView,
    AdminCardView,
    AdminFormat,
    AdminRowView,
    AdminText,
    AdminWorkspaceDetail,
} from "./admin.shared"
import { useAdminFormat } from "./useAdminFormat"

/** The most characters of a raw error text a row shows. */
const ERROR_CLIP = 300

const memberRows = (
    detail: AdminWorkspaceDetail,
    format: AdminFormat,
    text: AdminText,
): ReadonlyArray<AdminRowView> => [
    ...detail.members.map((member): AdminRowView => ({
        id: member.userId,
        title: member.displayName,
        lines: [member.email ?? text("empty")],
        badges: [
            badgeOf("role", member.role, member.role === "owner" ? "accent" : "neutral"),
            ...(member.status === "disabled" ? [badgeOf("disabled", text("memberDisabled"), "danger")] : []),
        ],
    })),
    ...detail.invites.map((invite): AdminRowView => ({
        id: invite.id,
        title: invite.email,
        lines: [
            text("inviteDetail", {
                created: format.date(invite.createdAt),
                expires: format.date(invite.expiresAt),
            }),
        ],
        badges: [badgeOf("pending", text("invitePending"), "warning"), badgeOf("role", invite.role, "neutral")],
    })),
]

const moduleRows = (detail: AdminWorkspaceDetail, format: AdminFormat, text: AdminText): ReadonlyArray<AdminRowView> =>
    detail.modules.map((entry): AdminRowView => {
        const context =
            typeof entry.contextVersion === "number"
                ? text("contextApplied", {
                      version: entry.contextVersion,
                      date: format.date(entry.contextAppliedAt),
                  })
                : text("contextNone")
        return {
            id: entry.id,
            title: entry.key,
            lines: [`${context} · ${entry.operatingMode}`],
            badges: [badgeOf("status", entry.status, moduleTone(entry.status), entry.live)],
        }
    })

const connectionRows = (
    detail: AdminWorkspaceDetail,
    format: AdminFormat,
    text: AdminText,
): ReadonlyArray<AdminRowView> =>
    detail.connections.map((entry): AdminRowView => ({
        id: entry.id,
        title: entry.name,
        lines: [
            text("connectionDetail", {
                provider: entry.provider,
                environment: entry.environment,
                event:
                    typeof entry.lastEventAt === "string"
                        ? text("connectionEvent", {
                              ago: format.ago(entry.lastEventAt),
                              at: format.dateTime(entry.lastEventAt),
                          })
                        : text("never"),
            }),
        ],
        ...(typeof entry.lastError === "string" ? { mono: entry.lastError } : {}),
        badges: [
            badgeOf("status", entry.status, "neutral"),
            badgeOf("health", entry.health, healthTone(entry.health), true),
        ],
    }))
const KNOWLEDGE_TONES: Readonly<Record<string, AdminBadgeView["tone"]>> = { failed: "danger", ready: "success" }
const knowledgeTone = (status: string): AdminBadgeView["tone"] => KNOWLEDGE_TONES[status] ?? "neutral"
const knowledgeRows = (detail: AdminWorkspaceDetail): ReadonlyArray<AdminRowView> =>
    detail.knowledge.map((entry): AdminRowView => ({
        id: entry.kind,
        title: entry.kind,
        lines: [],
        badges: entry.byStatus.map(({ key, count }) => badgeOf(key, `${key} ${count}`, knowledgeTone(key))),
    }))

const orderRows = (detail: AdminWorkspaceDetail, format: AdminFormat, text: AdminText): ReadonlyArray<AdminRowView> =>
    detail.orders.map((order): AdminRowView => {
        const values = { amount: format.vnd(order.amountVnd), created: format.dateTime(order.createdAt) }
        return {
            id: order.id,
            title: `${order.orderCode} · ${order.planCode}`,
            lines: [
                typeof order.paidAt === "string"
                    ? text("orderDetailPaid", { ...values, paid: format.dateTime(order.paidAt) })
                    : text("orderDetail", values),
            ],
            badges: [badgeOf("status", order.status, flowTone(order.status))],
        }
    })

const paymentRows = (
    detail: AdminWorkspaceDetail,
    format: AdminFormat,
    text: AdminText,
): ReadonlyArray<AdminRowView> => [
    ...detail.transfers.map((entry): AdminRowView => ({
        id: `transfer-${entry.sepayId}`,
        title: format.vnd(entry.transferAmount),
        lines: [text("transferDetail", { at: format.dateTime(entry.receivedAt), content: entry.content ?? "" })],
        badges: [badgeOf("status", entry.status, flowTone(entry.status))],
    })),
    ...detail.billingEvents.map((entry): AdminRowView => ({
        id: `event-${entry.id}`,
        title: text("billingEventAt", { at: format.dateTime(entry.createdAt) }),
        isMuted: true,
        lines: [],
        badges: [badgeOf("kind", entry.kind, entry.kind === "paid" ? "success" : "warning")],
    })),
]

const errorRows = (detail: AdminWorkspaceDetail, format: AdminFormat): ReadonlyArray<AdminRowView> =>
    detail.errors.map((error): AdminRowView => ({
        id: error.id,
        title: error.scope,
        lines: [],
        mono: error.message.slice(0, ERROR_CLIP),
        note: format.dateTime(error.createdAt),
        badges: [],
    }))

/** How one list card of a workspace reads its rows from the workspace. */
type CardSource = (detail: AdminWorkspaceDetail, format: AdminFormat, text: AdminText) => ReadonlyArray<AdminRowView>

/** The list cards under the overview of one workspace, in reading order; a workspace not read yet gives each card its label and no rows, and the logs (errors, transfers) show no count. */
const detailCards = (
    detail: AdminWorkspaceDetail | undefined,
    format: AdminFormat,
    text: AdminText,
): ReadonlyArray<AdminCardView> => {
    const card = (id: string, label: string, empty: string, rows: CardSource, counts = true): AdminCardView =>
        adminCard(id, label, empty, detail === undefined ? [] : rows(detail, format, text), counts)
    return [
        card("members", text("cardMembers"), text("empty"), memberRows),
        card("agents", text("cardAgents"), text("noAgents"), moduleRows),
        card("connections", text("cardConnections"), text("noConnections"), connectionRows),
        card("errors", text("cardErrors"), text("noErrors"), errorRows, false),
        card("transfers", text("cardTransfers"), text("noTransfers"), paymentRows, false),
        card("knowledge", text("cardKnowledge"), text("noKnowledge"), knowledgeRows),
        card("orders", text("cardOrders"), text("noOrders"), orderRows),
    ]
}

/** The list cards under the overview of one workspace, worded and formatted in the reader's locale; with no workspace yet, the same cards with no rows. */
export const useAdminDetailCards = (source: AdminWorkspaceDetail | undefined): ReadonlyArray<AdminCardView> => {
    const { text, format } = useAdminFormat()
    return useMemo(() => detailCards(source, format, text), [source, format, text])
}
