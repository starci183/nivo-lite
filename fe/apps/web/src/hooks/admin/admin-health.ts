import type { AdminHealth } from "@/modules/db/admin/admin.mapper"
import { adminWorkspacePath } from "@/modules/routes"
import { badgeOf, flowTone } from "./admin.shared"
import type { AdminCardView, AdminFormat, AdminRowView, AdminText } from "./admin.shared"

/** The most characters of a raw error text a row shows. */
const ERROR_CLIP = 400

/** How many of the newest transfers the billing card lists. */
const TRANSFERS_SHOWN = 10

/** The characters of an unnamed workspace id a link shows. */
const ID_SHOWN = 8

/** The link to a workspace, or the muted word for an event that belongs to the platform. */
const workspaceRef = (
    id: string | null,
    names: ReadonlyMap<string, string>,
    text: AdminText,
): Pick<AdminRowView, "link" | "note"> =>
    id === null
        ? { note: text("platform") }
        : { link: { label: names.get(id) ?? id.slice(0, ID_SHOWN), href: adminWorkspacePath(id) } }

const billingRows = (health: AdminHealth, format: AdminFormat, text: AdminText, names: ReadonlyMap<string, string>) => {
    const summary: ReadonlyArray<AdminRowView> =
        health.transfers.length === 0 && health.billingEvents.length === 0
            ? []
            : [
                  {
                      id: "summary",
                      title: text("billingSummary"),
                      isMuted: true,
                      lines: [],
                      badges: health.transferCounts.map((entry) =>
                          badgeOf(
                              entry.key,
                              text("billingStatusCount", { status: entry.key, count: entry.count }),
                              flowTone(entry.key),
                          ),
                      ),
                  },
              ]
    return [
        ...summary,
        ...health.transfers.slice(0, TRANSFERS_SHOWN).map((entry, index): AdminRowView => ({
            id: `transfer-${index}`,
            title: format.vnd(entry.transferAmount),
            lines: [text("transferDetail", { at: format.dateTime(entry.receivedAt), content: entry.content ?? "" })],
            badges: [badgeOf("status", entry.status, flowTone(entry.status))],
        })),
        ...health.billingEvents.map((entry): AdminRowView => ({
            id: `event-${entry.id}`,
            title: text("billingEventKind", { kind: entry.kind }),
            lines: [format.dateTime(entry.createdAt)],
            badges: [],
            ...workspaceRef(entry.workspaceId, names, text),
        })),
    ]
}

/** The list cards of the platform health page, in reading order. */
export const healthCards = (
    health: AdminHealth,
    format: AdminFormat,
    text: AdminText,
): ReadonlyArray<AdminCardView> => {
    const names = new Map(health.workspaceNames.map((entry) => [entry.id, entry.name]))
    return [
        {
            id: "signups",
            label: text("cardSignups"),
            ariaLabel: text("signupsAria"),
            emptyMessage: text("noSignups"),
            labelBadges: [],
            rows: health.signups.map((entry): AdminRowView => ({
                id: entry.day,
                title: entry.day,
                lines: [],
                badges: [badgeOf("count", String(entry.signups), "accent")],
            })),
        },
        {
            id: "billing",
            label: text("cardBilling"),
            emptyMessage: text("noBilling"),
            labelBadges: [],
            rows: billingRows(health, format, text, names),
        },
        {
            id: "audit",
            label: text("cardAudit"),
            emptyMessage: text("noAudit"),
            labelBadges: [],
            rows: health.audits.map((entry): AdminRowView => ({
                id: entry.id,
                title: entry.action,
                lines: [text("auditDetail", { actor: entry.actorEmail, at: format.dateTime(entry.createdAt) })],
                badges: [],
                ...workspaceRef(entry.workspaceId, names, text),
            })),
        },
        {
            id: "errors",
            label: text("cardAppErrors"),
            emptyMessage: text("noAppErrors"),
            labelBadges: health.errorScopes.map((entry) =>
                badgeOf(entry.key, text("errorScope", { scope: entry.key, count: entry.count }), "danger"),
            ),
            rows: health.errors.map((entry): AdminRowView => ({
                id: entry.id,
                title: entry.scope,
                lines: [],
                mono: entry.message.slice(0, ERROR_CLIP),
                badges: [],
                ...workspaceRef(entry.workspaceId, names, text),
                note: format.dateTime(entry.createdAt),
            })),
        },
    ]
}
