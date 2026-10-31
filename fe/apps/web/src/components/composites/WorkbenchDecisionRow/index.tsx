import type { ReactNode } from "react"
import { Badge, Button, DropdownMenu, ListRow, Text } from "@starci/grammar/common"
import { WorkbenchTraceLine } from "@/components/branches/WorkbenchTraceLine"
import type { WorkbenchRowView } from "@/modules/types"
import { ACTIONS_CLASS_NAME, DETAIL_CLASS_NAME } from "./classNames"

/** One row of a waiting list and the words that are not the row's own. */
export interface WorkbenchDecisionRowProps {
    readonly row: WorkbenchRowView
    /** The editor of the proposal (a draft, the fields, the basis), open when the row is. */
    readonly editor?: ReactNode
    readonly seeWhyLabel: string
    /** The name of the menu at the end of the row. */
    readonly moreLabel: string
    readonly isSkeleton: boolean
}

/**
 * One decision waiting for a person, or the agent's finished work, on `ListRow`: the customer or supplier, one line, state and age,
 * one visible command and a menu for the rest. The amount, the proposal, the editor, the trace and the expiry stand under the copy in
 * that order. Approving is never a row's visible command (it commits, and lives in the why pane footer).
 */
export const WorkbenchDecisionRow = (props: WorkbenchDecisionRowProps) => {
    const row = props.row
    const menu = row.menu.map((command) => ({
        id: command.id,
        label: command.label,
        onAction: command.onPress,
        ...(command.isDisabled === true ? { isDisabled: true } : {}),
        ...(command.isDanger === true ? { tone: "danger" as const } : {}),
    }))
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
            actions={
                <div className={ACTIONS_CLASS_NAME}>
                    {row.primary === null ? (
                        row.waitingFor === null ? null : (
                            <Text size="sm" tone="muted">
                                {row.waitingFor}
                            </Text>
                        )
                    ) : (
                        <Button
                            intent="alternative"
                            size="sm"
                            isPending={row.primary.isPending === true}
                            isDisabled={row.primary.isDisabled === true}
                            {...(row.primary.disabledReason === undefined
                                ? {}
                                : { disabledReason: row.primary.disabledReason })}
                            onPress={row.primary.onPress}
                        >
                            {row.primary.label}
                        </Button>
                    )}
                    {row.primary === null || menu.length === 0 ? null : (
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
                </div>
            }
        >
            <div className={DETAIL_CLASS_NAME}>
                {row.amount === null ? null : (
                    <Text size="md" weight="semibold" tabular>
                        {row.amount}
                    </Text>
                )}
                <Text size="sm">{row.proposal}</Text>
                {props.editor}
                {row.trace === null ? null : (
                    <WorkbenchTraceLine trace={row.trace} seeWhyLabel={props.seeWhyLabel} />
                )}
                {row.expiry === null ? null : (
                    <Text size="xs" tone="muted">
                        {row.expiry}
                    </Text>
                )}
            </div>
        </ListRow>
    )
}
