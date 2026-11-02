import type { ComponentProps } from "react"
import type { BadgeTone, ListRowData } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import { EmptyNotice, SurfaceCard, Stack } from "@starci/grammar/common"
import { ResponsibilityLine } from "@/components/branches/ResponsibilityLine"
import type { ResponsibilityRowLabels } from "@/components/branches/ResponsibilityLine"
import type { OwnerGroupView } from "@/modules/types"

/** The words of the owner groups. */
export interface OwnerGroupListLabels {
    readonly groupAria: string
    readonly groupOwnedBy: (name: string) => string
    readonly groupCards: (name: string) => string
    readonly count: (n: number) => string
    readonly ownerHuman: string
    readonly ownerAgent: string
    readonly ownerAgentHandle: (handle: string) => string
    readonly row: ResponsibilityRowLabels
    readonly empty: string
}

/** Props for OwnerGroupList. */
type OwnerGroupListProps = {
    readonly groups: ReadonlyArray<OwnerGroupView>
    readonly labels: OwnerGroupListLabels
    /** The groups are placeholders while the read is in flight: the same tree draws as a skeleton. */
    readonly isLoading: boolean
    readonly draftingId: string | null
    readonly copiedId: string | null
    readonly onDraft: (responsibilityId: string) => void
    readonly onCopy: (responsibilityId: string, leadId: string) => void
}

const roleOf = (group: OwnerGroupView, labels: OwnerGroupListLabels): string => {
    if (group.kind === "human") return labels.ownerHuman
    return group.handle === null ? labels.ownerAgent : labels.ownerAgentHandle(group.handle)
}

/** Responsibilities grouped by owner: a section per owner headed by its name and role, then its rows. */
export const OwnerGroupList = (props: OwnerGroupListProps) => {
    const { labels } = props
    return (
        <Stack gap="section">
            {props.groups.map((group) => (
                <SurfaceCard
                    kind="list"
                    key={group.key}
                    label={group.name}
                    fact={`${roleOf(group, labels)} · ${labels.count(group.rows.length)}`}
                    isLoading={props.isLoading}
                    items={group.rows.map((row) =>
                        responsibilityItemOf({
                            row,
                            labels: labels.row,
                            isLoading: props.isLoading,
                            isDrafting: props.draftingId === row.id,
                            isCopied: props.copiedId === row.id,
                            onDraft: props.onDraft,
                            onCopy: props.onCopy,
                        }),
                    )}
                    empty={<EmptyNotice message={labels.empty} />}
                />
            ))}
        </Stack>
    )
}

const RESPONSIBILITY_TONES: Record<ComponentProps<typeof ResponsibilityLine>["row"]["status"], BadgeTone> = {
    open: "neutral",
    waiting_approval: "accent",
    done: "success",
}
const RESPONSIBILITY_ICONS: Record<ComponentProps<typeof ResponsibilityLine>["row"]["status"], IconName> = {
    open: "pending",
    waiting_approval: "review",
    done: "complete",
}
/** The group owns row metadata, and the detail retains its commands and feedback. */
const responsibilityItemOf = (props: ComponentProps<typeof ResponsibilityLine>): ListRowData => {
    const { row, labels } = props
    return {
        id: row.id,
        leading: { icon: nivoIconSource(RESPONSIBILITY_ICONS[row.status], "leading") },
        title: row.title,
        description: row.customer,
        state: row.isOverdue ? "cautionary" : "neutral",
        badges:
            row.status === "waiting_approval" && row.ownerKind === "agent"
                ? [
                      { label: row.statusLabel, tone: RESPONSIBILITY_TONES[row.status], isDot: true },
                      { label: labels.aiDraft, tone: "accent" },
                  ]
                : [{ label: row.statusLabel, tone: RESPONSIBILITY_TONES[row.status], isDot: true }],
        detail: <ResponsibilityLine {...props} />,
    }
}
