import { EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import type { useAccountingUpcoming } from "@/hooks/accounting"

type AccountingUpcomingRowsCommands = ReturnType<typeof useAccountingUpcoming>["on"]

/** The resolved ready view, loading fact and atomic user commands. */
interface AccountingUpcomingRowsProps {
    readonly view: ReturnType<typeof useAccountingUpcoming>["props"]
    readonly isLoading: boolean
    readonly onOpenBrain: AccountingUpcomingRowsCommands["openBrain"]
}

/** The existing Accounting Upcoming ready anatomy, independent of read status. */
export const AccountingUpcomingRows = (props: AccountingUpcomingRowsProps) => {
    const actions = {
        openBrain: props.onOpenBrain,
    }
    return (
        <SurfaceCard
            kind="list"
            label={props.view.title}
            isLoading={props.isLoading}
            empty={
                <EmptyNotice
                    message={props.view.emptyMessage}
                    description={props.view.emptyBody}
                    {...(props.view.isUnknown
                        ? { actionLabel: props.view.openBrainLabel, onAction: actions.openBrain }
                        : {})}
                />
            }
            footer={
                props.view.note === null ? undefined : (
                    <Text size="sm" tone="muted">
                        {props.view.note}
                    </Text>
                )
            }
            items={props.view.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
                badges: [{ label: row.badge, tone: row.tone }],
            }))}
        />
    )
}
