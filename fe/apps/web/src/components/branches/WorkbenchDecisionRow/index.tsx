import type { ReactNode } from "react"
import { Badge, Button, Cluster, DropdownMenu, ListRow, Stack, Text } from "@starci/grammar/common"
import { WorkbenchTraceLine } from "@/components/leaves/WorkbenchTraceLine"
import type { WorkbenchRowView } from "@/modules/types"

/** One row of a waiting list and the words that are not the row's own. */
interface WorkbenchDecisionRowProps {
    readonly row: WorkbenchRowView
    /** The editor of the proposal (a draft, the fields, the basis), open when the row is. */
    readonly editor?: ReactNode
    readonly seeWhyLabel: string
    /** The name of the menu at the end of the row. */
    readonly moreLabel: string
    readonly isSkeleton: boolean
}

/** The words of the row's commands. */
interface RowActionsProps {
    readonly row: WorkbenchRowView
    readonly moreLabel: string
}

/** The row whose waiting line is drawn. */
interface WaitingForProps {
    readonly row: WorkbenchRowView
}

/** What stands at the end of a row when it has no command to press: who it waits for, or nothing. */
const WaitingFor = (props: WaitingForProps) =>
    props.row.waitingFor === null ? null : (
        <Text size="sm" tone="muted">
            {props.row.waitingFor}
        </Text>
    )

/** The one visible command of a row, then the menu for the rest. */
const RowActions = (props: RowActionsProps) => {
    const row = props.row
    const primary = row.primary
    const menu = row.menu.map((command) => ({
        id: command.id,
        label: command.label,
        onAction: command.onPress,
        ...(command.isDisabled === true ? { isDisabled: true } : {}),
        ...(command.isDanger === true ? { tone: "danger" as const } : {}),
    }))
    if (primary === null) return <WaitingFor row={row} />
    const edit = row.edit
    return (
        <Cluster gap="inline">
            <Button
                intent="alternative"
                size="sm"
                isPending={primary.isPending === true}
                isDisabled={primary.isDisabled === true}
                {...(primary.disabledReason === undefined ? {} : { disabledReason: primary.disabledReason })}
                onPress={primary.onPress}
            >
                {primary.label}
            </Button>
            {edit === null ? null : (
                <Button intent="neutral" size="sm" isDisabled={edit.isDisabled === true} onPress={edit.onPress}>
                    {edit.label}
                </Button>
            )}
            {menu.length === 0 ? null : (
                <DropdownMenu
                    placement="bottom end"
                    trigger={
                        <Button intent="neutral" size="sm">
                            {props.moreLabel}
                        </Button>
                    }
                    entries={menu}
                />
            )}
        </Cluster>
    )
}

/**
 * One decision waiting for a person, or the agent's finished work, on `ListRow`: the customer or supplier, one line, state and age,
 * a named command, a neutral edit and a menu for the rest. The amount, the proposal, the editor, the trace and the expiry stand under the copy in
 * that order. The named command is an alternative button, never a commit (the commit lives in the why pane footer).
 */
export const WorkbenchDecisionRow = (props: WorkbenchDecisionRowProps) => {
    const row = props.row
    return (
        <ListRow
            isSkeleton={props.isSkeleton}
            title={row.title}
            description={row.description}
            badges={
                row.badges.length === 0 ? undefined : (
                    <>
                        {row.badges.map((badge) => (
                            <Badge key={badge.label} tone={badge.tone}>
                                {badge.label}
                            </Badge>
                        ))}
                    </>
                )
            }
            actions={<RowActions row={row} moreLabel={props.moreLabel} />}
        >
            <Stack gap="identity">
                {row.reason === null ? null : (
                    <Text size="sm" tone="muted">
                        {row.reason}
                    </Text>
                )}
                {row.amount === null ? null : (
                    <Text size="md" weight="semibold" tabular>
                        {row.amount}
                    </Text>
                )}
                <Text size="sm">{row.proposal}</Text>
                {props.editor}
                {row.trace === null ? null : <WorkbenchTraceLine trace={row.trace} seeWhyLabel={props.seeWhyLabel} />}
                {row.expiry === null ? null : (
                    <Text size="xs" tone="muted">
                        {row.expiry}
                    </Text>
                )}
            </Stack>
        </ListRow>
    )
}
