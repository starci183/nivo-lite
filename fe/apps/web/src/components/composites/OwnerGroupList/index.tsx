import { Region, SurfaceListCard, Text } from "@starci/grammar/common"
import { OwnerBadge } from "@/components/branches/OwnerBadge"
import { ResponsibilityLine } from "@/components/branches/ResponsibilityLine"
import type { ResponsibilityRowLabels } from "@/components/branches/ResponsibilityLine"
import type { OwnerGroupView } from "@/modules/types"
import { GROUPS_CLASS, SECTION_HEAD_CLASS } from "./classNames"

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
}

/** Props for OwnerGroupList. */
type OwnerGroupListProps = {
    readonly groups: ReadonlyArray<OwnerGroupView>
    readonly labels: OwnerGroupListLabels
    /** The groups are placeholders while the read is in flight: the same tree draws as a skeleton. */
    readonly isSkeleton: boolean
    readonly draftingId: string | null
    readonly copiedId: string | null
    readonly onDraft: (responsibilityId: string) => void
    readonly onCopy: (responsibilityId: string, leadId: string) => void
}

const roleOf = (group: OwnerGroupView, labels: OwnerGroupListLabels): string => {
    if (group.kind === "human") return labels.ownerHuman
    return group.handle === null ? labels.ownerAgent : labels.ownerAgentHandle(group.handle)
}

/** Responsibilities grouped by owner: a header per owner, then one card per responsibility. */
export const OwnerGroupList = (props: OwnerGroupListProps) => {
    const { labels } = props
    return (
        <div className={GROUPS_CLASS}>
            {props.groups.map((group) => (
                <Region key={group.key} label={labels.groupOwnedBy(group.name)}>
                    <div className={SECTION_HEAD_CLASS}>
                        <OwnerBadge
                            kind={group.kind}
                            name={group.name}
                            handle={group.handle}
                            glyph={group.glyph}
                            role={roleOf(group, labels)}
                            isSkeleton={props.isSkeleton}
                        />
                        <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                            {labels.count(group.rows.length)}
                        </Text>
                    </div>
                    <SurfaceListCard ariaLabel={labels.groupCards(group.name)}>
                        {group.rows.map((row) => (
                            <ResponsibilityLine
                                key={row.id}
                                row={row}
                                labels={labels.row}
                                isSkeleton={props.isSkeleton}
                                isDrafting={props.draftingId === row.id}
                                isCopied={props.copiedId === row.id}
                                onDraft={props.onDraft}
                                onCopy={props.onCopy}
                            />
                        ))}
                    </SurfaceListCard>
                </Region>
            ))}
        </div>
    )
}
