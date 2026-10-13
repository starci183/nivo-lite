"use client"

import { useMemo } from "react"
import { badgeOf, flowTone, healthTone, moduleTone } from "./admin.shared"
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

const card = (id: string, label: string, emptyMessage: string, rows: ReadonlyArray<AdminRowView>): AdminCardView => ({
    id,
    label,
    emptyMessage,
    rows,
    labelBadges: [],
})

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
        const { sync } = entry
        const context =
            typeof entry.contextVersion === "number"
                ? text("contextApplied", {
                      version: entry.contextVersion,
                      date: format.date(entry.contextAppliedAt),
                  })
                : text("contextNone")
        const syncLine =
            sync == null
                ? []
                : [
                      text("syncLine", {
                          agent: sync.agentId,
                          status: sync.status,
                          version: sync.contextVersion ?? text("empty"),
                          checked: format.ago(sync.checkedAt),
                      }),
                  ]
        const syncBadge =
            sync == null
                ? []
                : [
                      badgeOf(
                          "sync",
                          text("syncBadge", { status: sync.status }),
                          sync.status === "ok" ? "success" : "danger",
                      ),
                  ]
        return {
            id: entry.id,
            title: entry.key,
            lines: [`${context} · ${entry.operatingMode}`, ...syncLine],
            ...(sync?.error ? { mono: sync.error } : {}),
            badges: [
                badgeOf("status", entry.status, moduleTone(entry.status), entry.live),
                badgeOf("processor", entry.processor, entry.processor === "openclaw" ? "accent" : "neutral"),
                ...syncBadge,
            ],
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

/** The list cards under the overview of one workspace, in reading order. */
const detailCards = (
    detail: AdminWorkspaceDetail,
    format: AdminFormat,
    text: AdminText,
): ReadonlyArray<AdminCardView> => [
    card("members", text("cardMembers"), text("empty"), memberRows(detail, format, text)),
    card("agents", text("cardAgents"), text("noAgents"), moduleRows(detail, format, text)),
    card("connections", text("cardConnections"), text("noConnections"), connectionRows(detail, format, text)),
    card("knowledge", text("cardKnowledge"), text("noKnowledge"), knowledgeRows(detail)),
    card("orders", text("cardOrders"), text("noOrders"), orderRows(detail, format, text)),
    card("transfers", text("cardTransfers"), text("noTransfers"), paymentRows(detail, format, text)),
    card("errors", text("cardErrors"), text("noErrors"), errorRows(detail, format)),
]

/** The list cards under the overview of one workspace, worded and formatted in the reader's locale. */
export const useAdminDetailCards = (
    source: AdminWorkspaceDetail | undefined,
): ReadonlyArray<AdminCardView> | undefined => {
    const { text, format } = useAdminFormat()
    return useMemo(() => (source === undefined ? undefined : detailCards(source, format, text)), [source, format, text])
}
