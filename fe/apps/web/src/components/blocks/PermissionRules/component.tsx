import { Badge, Button, ListRow, SurfaceListCard } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { PermissionRuleDrawer } from "@/components/composites/PermissionRuleDrawer"
import type { PermissionRuleDrawerProps } from "@/components/composites/PermissionRuleDrawer"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One rule of the list, every word already resolved. */
export interface PermissionRowView {
    readonly id: string
    readonly title: string
    /** The agents it covers, whom it asks and how they decide, on one line. */
    readonly description: string
    readonly modeLabel: string
    readonly modeTone: BadgeTone
}

/** Copy, rows and state the connected list supplies. */
export interface PermissionRulesBaseProps {
    readonly props: {
        readonly title: string
        readonly editLabel: string
        readonly footnote: string
        /** Staff may read the list but not open a rule. */
        readonly isLocked: boolean
        readonly slot: DataSlot<ReadonlyArray<PermissionRowView>>
        readonly placeholder: ReadonlyArray<PermissionRowView>
        readonly slotLabels: SlotLabels
        /** The drawer while it is open; null when it is closed. */
        readonly drawer: PermissionRuleDrawerProps["props"] | null
    }
    readonly on: PermissionRuleDrawerProps["on"] & {
        readonly open: (id: string) => void
        readonly retry: () => void
    }
}

/** The rules of the Quyen page: what each agent may do alone, whom it asks and how they decide, one row per kind of work. */
export const PermissionRulesBase = (props: PermissionRulesBaseProps) => {
    const view = props.props
    return (
        <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
            {(rows, isSkeleton) => (
                <>
                    <SurfaceListCard label={view.title} headingLevel={2} footer={view.footnote}>
                        {rows.map((row) => (
                            <ListRow
                                key={row.id}
                                isSkeleton={isSkeleton}
                                title={row.title}
                                {...(row.description === "" ? {} : { description: row.description })}
                                badges={<Badge tone={row.modeTone}>{row.modeLabel}</Badge>}
                                actions={
                                    view.isLocked ? undefined : (
                                        <Button intent="neutral" size="sm" onPress={() => props.on.open(row.id)}>
                                            {view.editLabel}
                                        </Button>
                                    )
                                }
                            />
                        ))}
                    </SurfaceListCard>
                    {view.drawer === null ? null : <PermissionRuleDrawer props={view.drawer} on={props.on} />}
                </>
            )}
        </SlotView>
    )
}
