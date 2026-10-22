import { Badge, Button, DataTable, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone, DataTableColumn, DataTableRow } from "@starci/grammar/common"
import { PermissionRuleDrawer } from "@/components/composites/PermissionRuleDrawer"
import type { PermissionRuleDrawerProps } from "@/components/composites/PermissionRuleDrawer"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTION_CELL_CLASS_NAME, GROUP_CELL_CLASS_NAME } from "./classNames"

/** One rule of the table, every word already resolved. */
export interface PermissionRowView extends DataTableRow {
    readonly title: string
    readonly department: string
    readonly agents: string
    readonly modeLabel: string
    readonly modeTone: BadgeTone
    readonly group: ReadonlyArray<string>
    readonly policy: string
}

/** Copy, rows and state the connected table supplies. */
export interface PermissionRulesBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly columns: ReadonlyArray<DataTableColumn>
        readonly noneLabel: string
        readonly editLabel: string
        readonly footnote: string
        /** Staff may read the table but not open a rule. */
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

/** The rule table of the Quyen page: what each agent may do alone, whom it asks and how they decide. */
export const PermissionRulesBase = (props: PermissionRulesBaseProps) => {
    const view = props.props
    const renderCell = (row: PermissionRowView, columnId: string) => {
        if (columnId === "action") {
            return (
                <div className={ACTION_CELL_CLASS_NAME}>
                    <Text weight="semibold">{row.title}</Text>
                    <Text size="xs" tone="muted">
                        {row.department}
                    </Text>
                </div>
            )
        }
        if (columnId === "agents") return <Text size="sm">{row.agents}</Text>
        if (columnId === "mode") return <Badge tone={row.modeTone}>{row.modeLabel}</Badge>
        if (columnId === "group") {
            return row.group.length === 0 ? (
                <Text size="sm" tone="muted">
                    {view.noneLabel}
                </Text>
            ) : (
                <div className={GROUP_CELL_CLASS_NAME}>
                    {row.group.map((entry) => (
                        <Badge key={entry} tone="neutral">
                            {entry}
                        </Badge>
                    ))}
                </div>
            )
        }
        if (columnId === "policy") {
            return (
                <Text size="sm" tone={row.policy === "" ? "muted" : undefined}>
                    {row.policy === "" ? view.noneLabel : row.policy}
                </Text>
            )
        }
        return view.isLocked ? null : (
            <Button variant="outline" size="sm" onPress={() => props.on.open(row.id)}>
                {view.editLabel}
            </Button>
        )
    }
    return (
        <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
            {(rows, isSkeleton) => (
                <SurfaceCard label={view.title} headingLevel={2}>
                    <Text size="sm" tone="muted">
                        {view.description}
                    </Text>
                    <DataTable
                        label={view.title}
                        columns={view.columns}
                        rows={rows}
                        renderCell={renderCell}
                        isLoading={isSkeleton}
                        emptyContent={null}
                        onRowAction={view.isLocked ? undefined : props.on.open}
                    />
                    <Text size="xs" tone="muted">
                        {view.footnote}
                    </Text>
                    {view.drawer === null ? null : <PermissionRuleDrawer props={view.drawer} on={props.on} />}
                </SurfaceCard>
            )}
        </SlotView>
    )
}
