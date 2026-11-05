import type { ReactNode } from "react"
import { Badge, Button, Cluster, DropdownMenu, IconButton, Link, Quote, Stack, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkbenchRowData } from "@/modules/types"

/** One row of a waiting list and the words that are not the row's own. */
interface WorkbenchDecisionRowProps {
    readonly row: WorkbenchRowData
    /** The editor of the proposal (a draft, the fields, the basis), open when the row is. */
    readonly editor?: ReactNode
    readonly seeWhyLabel: string
    /** The name of the menu at the end of the row's commands. */
    readonly moreLabel: string
    readonly onCommand: (rowId: string, commandId: string) => void
}

/** The words of the row's commands. */
interface RowActionsProps {
    readonly row: WorkbenchRowData
    readonly seeWhyLabel: string
    readonly moreLabel: string
    readonly onCommand: (rowId: string, commandId: string) => void
}

/** The row whose waiting line is drawn. */
interface WaitingForProps {
    readonly row: WorkbenchRowData
}

/** What stands at the end of a row when it has no command to press: who it waits for, or nothing. */
const WaitingFor = (props: WaitingForProps) =>
    props.row.waitingFor === null ? null : (
        <Text size="sm" tone="muted">
            {props.row.waitingFor}
        </Text>
    )

/** The commands of a row in one line: the named command, the neutral edit, the menu for the rest, and the way to why at the end. */
const RowActions = (props: RowActionsProps) => {
    const row = props.row
    const primary = row.primary
    const menu = row.menu.map((command) => ({
        id: command.id,
        label: command.label,
        onAction: () => props.onCommand(row.id, command.id),
        ...(command.isDisabled === true ? { isDisabled: true } : {}),
        ...(command.isDanger === true ? { tone: "danger" as const } : {}),
    }))
    if (primary === null) return <WaitingFor row={row} />
    const edit = row.edit
    const why = row.trace?.whyHref ?? null
    return (
        <Cluster gap="inline" justify="between">
            <Cluster gap="inline">
                <Button
                    intent="alternative"
                    size="sm"
                    isPending={primary.isPending === true}
                    isDisabled={primary.isDisabled === true}
                    {...(primary.disabledReason === undefined ? {} : { disabledReason: primary.disabledReason })}
                    onPress={() => props.onCommand(row.id, primary.id)}
                >
                    {primary.label}
                </Button>
                {edit === null ? null : (
                    <Button
                        intent="neutral"
                        size="sm"
                        isDisabled={edit.isDisabled === true}
                        onPress={() => props.onCommand(row.id, edit.id)}
                    >
                        {edit.label}
                    </Button>
                )}
                {menu.length === 0 ? null : (
                    <DropdownMenu
                        placement="bottom end"
                        trigger={
                            <IconButton
                                intent="neutral"
                                source={nivoIconSource("more", "leading")}
                                label={props.moreLabel}
                            />
                        }
                        entries={menu}
                    />
                )}
            </Cluster>
            {why === null ? null : <Link href={why}>{props.seeWhyLabel}</Link>}
        </Cluster>
    )
}

/** The chips under a row's copy: the amount first (neutral), then the state and age marks with their own tones. */
const RowChips = (props: WaitingForProps) => {
    const row = props.row
    if (row.amount === null && row.badges.length === 0) return null
    return (
        <Cluster gap="inline">
            {row.amount === null ? null : <Badge tone="neutral">{row.amount}</Badge>}
            {row.badges.map((badge) => (
                <Badge key={badge.label} tone={badge.tone}>
                    {badge.label}
                </Badge>
            ))}
        </Cluster>
    )
}

/**
 * One decision waiting for a person, or the agent's finished work, as typed collection data: the customer or supplier and one line
 * (the row's own copy), then under it the chips (amount, state, age), why the agent needs the owner, the proposal as a quote, the
 * editor, the trace and the expiry, and last one line of commands: the named command, a neutral edit, a menu for the rest and the
 * way to why at the end. The named command is an alternative button, never a commit (the commit lives in the why pane footer).
 */
export const WorkbenchDecisionRow = (props: WorkbenchDecisionRowProps) => {
    const row = props.row

    return (
        <Stack gap="identity">
            <RowChips row={row} />
            {row.reason === null ? null : (
                <Text size="sm" tone="muted">
                    {row.reason}
                </Text>
            )}
            {row.proposal === "" ? null : <Quote text={row.proposal} />}
            {props.editor}
            {row.trace === null ? null : (
                <Text size="xs" tone="muted">
                    {row.trace.line}
                </Text>
            )}
            {row.expiry === null ? null : (
                <Text size="xs" tone="muted">
                    {row.expiry}
                </Text>
            )}
            <RowActions
                row={row}
                seeWhyLabel={props.seeWhyLabel}
                moreLabel={props.moreLabel}
                onCommand={props.onCommand}
            />
        </Stack>
    )
}
