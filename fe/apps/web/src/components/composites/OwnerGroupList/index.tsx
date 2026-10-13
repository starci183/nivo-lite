import { EmptyNotice, Region, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common"
import { OwnerBadge } from "@/components/branches/OwnerBadge"
import { ResponsibilityLine } from "@/components/branches/ResponsibilityLine"
import type { ResponsibilityRowLabels } from "@/components/branches/ResponsibilityLine"
import type { OwnerGroupView } from "@/hooks/responsibilities"
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
    readonly emptyMessage: string
    readonly emptyDescription: string
    /** The action of the empty notice; with none it only explains. */
    readonly emptyAction?: { readonly label: string; readonly onAction: () => void }
    /** The collection is loading: one list card of skeleton rows. */
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

/** Responsibilities grouped by owner: a header per owner, then one card per responsibility, or an empty notice. */
export const OwnerGroupList = (props: OwnerGroupListProps) => {
    const { labels } = props
    if (props.isLoading) return <SurfaceListCard ariaLabel={labels.groupAria} isLoading />
    if (props.groups.length === 0) {
        return (
            <SurfaceCard ariaLabel={labels.groupAria}>
                <EmptyNotice
                    message={props.emptyMessage}
                    description={props.emptyDescription}
                    actionLabel={props.emptyAction?.label}
                    actionVariant="secondary"
                    onAction={props.emptyAction?.onAction}
                />
            </SurfaceCard>
        )
    }
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
                        />
                        <Text size="sm" tone="muted">
                            {labels.count(group.rows.length)}
                        </Text>
                    </div>
                    <SurfaceListCard ariaLabel={labels.groupCards(group.name)}>
                        {group.rows.map((row) => (
                            <ResponsibilityLine
                                key={row.id}
                                row={row}
                                labels={labels.row}
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
