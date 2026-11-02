import {
    AlertDialog,
    Badge,
    Button,
    Cluster,
    DataTable,
    DropdownMenu,
    EmptyNotice,
    Stack,
    Text,
    type DataTableColumn,
} from "@starci/grammar/common"

import { TeamSection } from "@/components/frames/TeamSection"
import { SlotView } from "@/components/composites/SlotView"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, MemberRowView, SlotLabels } from "@/modules/types"
import { IDENTITY_CLASS_NAME } from "./classNames"

/** The question asked before a remove or a disable. */
interface ConfirmView {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
}

/** Copy, rows and state the connected members table supplies. */
export interface TeamMembersBaseProps {
    readonly props: {
        readonly title: string
        readonly description?: string | undefined
        readonly youLabel: string
        readonly activeLabel: string
        readonly disabledLabel: string
        readonly actionsLabel: string
        readonly cancelLabel: string
        readonly columns: ReadonlyArray<DataTableColumn>
        /** The heading and the column headers stay; the body is the slot of the rows. */
        readonly slot: DataSlot<ReadonlyArray<MemberRowView>>
        readonly placeholder: ReadonlyArray<MemberRowView>
        readonly slotLabels: SlotLabels
        readonly isPending: boolean
        readonly confirm?: ConfirmView | undefined
    }
    readonly on: {
        readonly retry: () => void
        readonly cancelConfirm: () => void
        readonly confirm: () => void
    }
}

/** Draws the members of the workspace as a table: who they are, role, status, last sign-in and the actions menu. */
export const TeamMembersBase = (props: TeamMembersBaseProps) => {
    const renderCell = (row: MemberRowView, columnId: string) => {
        if (columnId === "member") {
            return (
                <div className={IDENTITY_CLASS_NAME}>
                    <Cluster gap="row">
                        <PersonAvatar name={row.name} size="md" />
                        <Stack gap="identity">
                            <Cluster gap="inline">
                                <Text isStrong overflow="truncate">
                                    {row.name}
                                </Text>
                                {row.isYou ? <Badge tone="neutral">{props.props.youLabel}</Badge> : null}
                            </Cluster>
                            <Text size="sm" tone="muted" overflow="truncate">
                                {row.email}
                            </Text>
                            {row.staffNote === undefined ? null : (
                                <Text size="xs" tone="muted" overflow="truncate">
                                    {row.staffNote}
                                </Text>
                            )}
                        </Stack>
                    </Cluster>
                </div>
            )
        }
        if (columnId === "role") {
            return (
                <Text size="sm" isStrong>
                    {row.roleLabel}
                </Text>
            )
        }
        if (columnId === "status") {
            return (
                <Badge tone={row.isActive ? "success" : "neutral"}>
                    {row.isActive ? props.props.activeLabel : props.props.disabledLabel}
                </Badge>
            )
        }
        if (columnId === "lastSignIn") return <Text size="sm">{row.lastSignIn}</Text>
        if (row.entries.length === 0) return null
        return (
            <DropdownMenu
                placement="bottom end"
                entries={row.entries}
                trigger={
                    <Button intent="neutral" isPending={props.props.isPending} aria-label={row.menuLabel}>
                        {props.props.actionsLabel}
                    </Button>
                }
            />
        )
    }
    return renderMembersSection({ props, renderCell })
}

const renderMembersSection = ({ props, renderCell }: RenderMembersSectionInput) => (
    <TeamSection id="team-members-title" title={props.props.title} description={props.props.description}>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(rows, isSkeleton) => (
                <DataTable
                    label={props.props.title}
                    columns={props.props.columns}
                    rows={rows}
                    renderCell={renderCell}
                    isLoading={isSkeleton}
                    emptyContent={<EmptyNotice message={props.props.title} />}
                />
            )}
        />
        <AlertDialog
            isOpen={props.props.confirm !== undefined}
            onOpenChange={(open) => {
                if (!open) props.on.cancelConfirm()
            }}
            title={props.props.confirm?.title ?? ""}
            description={props.props.confirm?.description}
            tone="negative"
            confirmLabel={props.props.confirm?.confirmLabel ?? ""}
            cancelLabel={props.props.cancelLabel}
            isConfirmPending={props.props.isPending}
            onConfirm={props.on.confirm}
            onCancel={props.on.cancelConfirm}
        />
    </TeamSection>
)

type RenderMembersSectionInput = {
    props: TeamMembersBaseProps
    renderCell: (row: MemberRowView, columnId: string) => React.ReactNode
}
