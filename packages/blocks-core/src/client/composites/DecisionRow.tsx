import { useState } from "react"
import type { ReactNode } from "react"
import { Badge, Button, Cluster, DropdownMenu, Stack, Text } from "@starci/grammar/common"
import type { EditAnswer } from "../../rows/decision-commands"
import type { FormValues } from "../../rows/form-values"
import type { DecisionRowView } from "../../views/views.types"
import { TraceLine } from "../leaves/TraceLine"
import { DecisionEditForm } from "./DecisionEditForm"
import type { DecisionEditFormProps } from "./DecisionEditForm"

/** What a row needs to edit a decision in place: the form the spec declares, and how its values are sent for this row. */
export interface DecisionEdit extends Pick<DecisionEditFormProps, "fields" | "currency" | "words"> {
    /** Sends the values of the edit of the row with this id and says how it ended. */
    readonly onSend: (rowId: string, values: FormValues) => Promise<EditAnswer>
}

/** One row of a decision queue and the words that are not the row's own. */
interface DecisionRowProps {
    readonly row: DecisionRowView
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
    readonly moreLabel: string
    /** Opens the inline edit form; absent runs the edit command of the row as any other. */
    readonly onEdit?: (() => void) | undefined
    readonly onCommand: (rowId: string, commandId: string) => void
}

/** The look of the named command: an alternative button, or the destructive one when the command cannot be taken back. */
const PLAIN_INTENT = { intent: "alternative" } as const
const DANGER_INTENT = { intent: "destructive" } as const

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
        <Cluster gap="inline">
            <Button
                {...(primary.isDanger === true ? DANGER_INTENT : PLAIN_INTENT)}
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
                    onPress={props.onEdit ?? (() => props.onCommand(row.id, edit.id))}
                >
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
 * One decision waiting for a person: the reason, the amount, the proposal, the trace and the expiry under the copy, then a named
 * command, a neutral edit and a menu for the rest. The named command is an alternative button, never a commit. With an edit form
 * declared by the spec, the edit control opens that form under the commands instead of running the edit command at once.
 */
export const DecisionRow = (props: DecisionRowProps): ReactNode => {
    const row = props.row
    const edit = props.edit
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
            {row.reason === null ? null : (
                <Text size="sm" tone="muted">
                    {row.reason}
                </Text>
            )}
            {row.amount === null ? null : (
                <Text size="md" isStrong tabular>
                    {row.amount}
                </Text>
            )}
            <Text size="sm">{row.proposal}</Text>
            {row.trace === null ? null : <TraceLine trace={row.trace} seeWhyLabel={props.seeWhyLabel} />}
            {row.expiry === null ? null : (
                <Text size="xs" tone="muted">
                    {row.expiry}
                </Text>
            )}
            <RowActions
                row={row}
                moreLabel={props.moreLabel}
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
