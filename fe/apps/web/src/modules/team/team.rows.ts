import type { BadgeTone, ListRowData } from "@starci/grammar/common"
interface TeamRowIdentity {
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly actionLabel: string
    readonly href: string
}
/** Preserves native agent identity and its setup detail without owning a visual. */
export const agentTeamItemOf = (row: TeamRowIdentity, id: string, detail: ListRowData["detail"]): ListRowData => ({
    id,
    title: row.name,
    description: row.description,
    leading: { avatar: { name: row.name, seed: row.seed, src: row.avatarUrl, kind: "agent" } },
    badges: [{ label: row.statusLabel, tone: row.statusTone, isDot: true }],
    action: { label: row.actionLabel, intent: "neutral", href: row.href },
    detail,
})
