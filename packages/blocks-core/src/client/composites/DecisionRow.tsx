import { useState, type ReactNode } from "react"
import { Badge, Button, Cluster, DropdownMenu, Link, Quote, Stack, Text } from "@starci/grammar/common"
import type { EditAnswer } from "../../rows/decision-commands"
import type { FormValues } from "../../rows/form-values"
import type { CommandView, DecisionRowView } from "../../views/views.types"
import { decisionLinesOf } from "../../rows/decision-lines"
import { DecisionEditForm, type DecisionEditFormProps } from "./DecisionEditForm"

/** What a row needs to edit a decision in place: the form the spec declares, and how its values are sent for this row. */
export interface DecisionEdit extends Pick<DecisionEditFormProps, "fields" | "currency" | "words"> {
    /** Sends the values of the edit of the row with this id and says how it ended. */
    readonly onSend: (rowId: string, values: FormValues) => Promise<EditAnswer>
}

/** One row of a decision queue and the words that are not the row's own. */
interface DecisionRowProps {
    readonly row: DecisionRowView
    /** How large the commands are. */
    readonly commandSize: "sm" | "md"
    readonly seeWhyLabel: string
    /** The name of the menu at the end of the row. */
    readonly moreLabel: string
    /** The inline edit form the spec declares; null runs the edit command of the row as any other. */
    readonly edit: DecisionEdit | null
    readonly onCommand: (rowId: string, commandId: string) => void
}

/** The commands of a row and the words of its menu. */
interface RowActionsProps {
    readonly row: DecisionRowView
    readonly commandSize: "sm" | "md"
    readonly moreLabel: string
    /** Opens the inline edit form; absent runs the edit command of the row as any other. */
    readonly onEdit?: (() => void) | undefined
    readonly onCommand: (rowId: string, commandId: string) => void
}

/** What one command button of a row is given. */
interface RowButtonProps {
    readonly command: CommandView
    /** The look when neither the row nor the spec gives the command one. */
    readonly fallback: "alternative" | "neutral"
    readonly size: "sm" | "md"
    readonly onPress: () => void
}

/** One command of a row as a button: the destructive one when it cannot be taken back, else the look the row or the spec gives it. */
const RowButton = (props: RowButtonProps): ReactNode => {
    const { command } = props
    const shared = {
        size: props.size,
        isPending: command.isPending === true,
        isDisabled: command.isDisabled === true,
        ...(command.disabledReason === undefined ? {} : { disabledReason: command.disabledReason }),
        onPress: props.onPress,
    }
    if (command.isDanger === true) {
        return (
            <Button intent="destructive" {...shared}>
                {command.label}
            </Button>
        )
    }
    switch (command.intent ?? props.fallback) {
        case "commit":
            return (
                <Button intent="commit" {...shared}>
                    {command.label}
                </Button>
            )
        case "dismiss":
            return (
                <Button intent="dismiss" {...shared}>
                    {command.label}
                </Button>
            )
        case "neutral":
            return (
                <Button intent="neutral" {...shared}>
                    {command.label}
                </Button>
            )
        case "alternative":
            return (
                <Button intent="alternative" {...shared}>
                    {command.label}
                </Button>
            )
    }
}

/** The row whose waiting line is drawn. */
interface WaitingForProps {
    readonly row: DecisionRowView
}

/** What stands at the end of a row when it has no command to press: who it waits for, or nothing. */
const WaitingFor = (props: WaitingForProps): ReactNode =>
    props.row.waitingFor === null ? null : (
        <Text size="sm" tone="muted">
            {props.row.waitingFor}
        </Text>
    )

/** The one visible command of a row, then the menu for the rest. */
const RowActions = (props: RowActionsProps): ReactNode => {
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
    return (
        <Cluster gap="inline" wrap={false}>
            <RowButton
                command={primary}
                fallback="alternative"
                size={props.commandSize}
                onPress={() => props.onCommand(row.id, primary.id)}
            />
            {edit === null ? null : (
                <RowButton
                    command={edit}
                    fallback="neutral"
                    size={props.commandSize}
                    onPress={props.onEdit ?? (() => props.onCommand(row.id, edit.id))}
                />
            )}
            {menu.length === 0 ? null : (
                <DropdownMenu
                    placement="bottom end"
                    trigger={
                        <Button intent="neutral" size={props.commandSize}>
                            {props.moreLabel}
                        </Button>
                    }
                    entries={menu}
                />
            )}
        </Cluster>
    )
}

/** The commands of a row and the words of the link to why. */
interface RowFootProps extends RowActionsProps {
    readonly seeWhyLabel: string
}

/** The line under the commands: the commands, and the link to why the agent stopped when a decision is recorded. */
const RowFoot = (props: RowFootProps): ReactNode => {
    const whyHref = props.row.trace?.whyHref ?? null
    return (
        <Cluster gap="row" wrap={false} justify="between" align="center">
            <RowActions {...props} />
            {whyHref === null ? null : <Link href={whyHref}>{props.seeWhyLabel}</Link>}
        </Cluster>
    )
}

/**
 * One decision waiting for a person: what the agent stopped on under the copy (the reason, the amount as a neutral chip, the words
 * proposed in a quote, the trace and the expiry, none of them repeating a line above), then a named command, a neutral edit and a
 * menu for the rest, and the link to why. With an edit form declared by the spec, the edit control opens that form under the
 * commands instead of running the edit command at once.
 */
export const DecisionRow = (props: DecisionRowProps): ReactNode => {
    const row = props.row
    const edit = props.edit
    const lines = decisionLinesOf(row)
    const [isEditing, setIsEditing] = useState(false)
    return (
        <Stack gap="identity">
            {row.badges.length < 3 ? null : (
                <Cluster gap="inline">
                    {row.badges.slice(2).map((badge) => (
                        <Badge key={badge.label} tone={badge.tone}>
                            {badge.label}
                        </Badge>
                    ))}
                </Cluster>
            )}
            {lines.reason === null ? null : (
                <Text size="sm" tone="muted">
                    {lines.reason}
                </Text>
            )}
            {row.amount === null ? null : (
                <Cluster gap="inline">
                    <Badge tone="neutral">{row.amount}</Badge>
                </Cluster>
            )}
            {lines.proposal === null ? null : <Quote text={lines.proposal} />}
            {lines.trace === null ? null : (
                <Text size="xs" tone="muted">
                    {lines.trace}
                </Text>
            )}
            {row.expiry === null ? null : (
                <Text size="xs" tone="muted">
                    {row.expiry}
                </Text>
            )}
            <RowFoot
                row={row}
                commandSize={props.commandSize}
                moreLabel={props.moreLabel}
                seeWhyLabel={props.seeWhyLabel}
                onCommand={props.onCommand}
                {...(edit === null ? {} : { onEdit: () => setIsEditing(true) })}
            />
            {edit === null || !isEditing ? null : (
                <DecisionEditForm
                    fields={edit.fields}
                    draft={row.draft}
                    currency={edit.currency}
                    words={edit.words}
                    onSend={(values) => edit.onSend(row.id, values)}
                    onClose={() => setIsEditing(false)}
                />
            )}
        </Stack>
    )
}
