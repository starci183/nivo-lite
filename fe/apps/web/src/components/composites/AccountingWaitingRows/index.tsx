import {
    Alert,
    Button,
    Cluster,
    DropdownMenu,
    EmptyNotice,
    IconButton,
    Link,
    Section,
    Stack,
    Text,
    Badge,
    Textarea,
} from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AccountingWorkbenchActions, AccountingWorkbenchDataView } from "@/modules/types"

/** The basis a question asks the decider to write. */
interface WaitingBasisView {
    readonly value: string
    readonly label: string
    readonly hint: string
}

/** One question waiting for a person, with what it proposes and what the member may do about it. */
interface AccountingWaitingRow {
    readonly id: string
    readonly title: string
    readonly summary: string
    /** Why the agent stopped and needs a person, in plain words. */
    readonly reason: string
    readonly status: string
    readonly tone: "danger" | "success" | "warning"
    readonly amount: string | null
    /** The member may decide this question now. */
    readonly canAct: boolean
    readonly isOpen: boolean
    readonly isBusy: boolean
    /** Approve stays off until the basis the question asks for is written. */
    readonly isApproveDisabled: boolean
    readonly basis: WaitingBasisView | null
    readonly approveLabel: string
    readonly rejectLabel: string
    /** Who the question waits for, said to a member who may not decide it. */
    readonly waitingLabel: string
    readonly error: string | null
}

/** What the card does, addressed to a question. */
interface AccountingWaitingOn {
    readonly approve: (id: string) => void
    readonly reject: (id: string) => void
    readonly changeBasis: (id: string, value: string) => void
}

/**
 * One waiting question as item data: one visible Approve (an alternative command, never a commit in a row) with Reject in the menu;
 * under the copy the reason, the amount, the basis to write, an error, or who the question waits for when the member may not decide it.
 */
const itemOf = (row: AccountingWaitingRow, moreMenuLabel: string, on: AccountingWaitingOn): ListRowData => ({
    id: row.id,
    title: row.title,
    description: row.summary,
    detail: (
        <Stack gap="inline">
            <Cluster gap="inline">
                {row.amount === null ? null : <Badge tone="neutral">{row.amount}</Badge>}
                <Badge tone={row.tone}>{row.status}</Badge>
            </Cluster>
            {row.canAct ? (
                <Cluster gap="inline">
                    <Button
                        intent="alternative"
                        isPending={row.isBusy}
                        isDisabled={row.isApproveDisabled}
                        onPress={() => on.approve(row.id)}
                    >
                        {row.approveLabel}
                    </Button>
                    <DropdownMenu
                        placement="bottom end"
                        trigger={
                            <IconButton
                                source={nivoIconSource("more", "leading")}
                                label={moreMenuLabel}
                                intent="neutral"
                                isDisabled={row.isBusy}
                            />
                        }
                        entries={[
                            { id: "reject", label: row.rejectLabel, tone: "danger", onAction: () => on.reject(row.id) },
                        ]}
                    />
                </Cluster>
            ) : null}
            <Text size="sm" tone="muted">
                {row.reason}
            </Text>
            {row.basis !== null && row.canAct ? (
                <Textarea
                    label={row.basis.label}
                    description={row.basis.hint}
                    rows={2}
                    value={row.basis.value}
                    isDisabled={row.isBusy}
                    onValueChange={(value) => on.changeBasis(row.id, value)}
                />
            ) : null}
            {row.error === null ? null : <Alert tone="negative" title={row.error} />}
            {row.isOpen && !row.canAct ? (
                <Text size="sm" tone="muted">
                    {row.waitingLabel}
                </Text>
            ) : null}
        </Stack>
    ),
})

type AccountingWaitingRowsCommands = AccountingWorkbenchActions["waiting"]

/** The resolved ready view, loading fact and atomic user commands. */
interface AccountingWaitingRowsProps {
    readonly view: AccountingWorkbenchDataView["waiting"]["placeholder"]
    readonly isLoading: boolean
    readonly onApprove: AccountingWaitingRowsCommands["approve"]
    readonly onReject: AccountingWaitingRowsCommands["reject"]
    readonly onChangeBasis: AccountingWaitingRowsCommands["changeBasis"]
}

/** The existing Accounting Waiting ready anatomy, independent of read status. */
export const AccountingWaitingRows = (props: AccountingWaitingRowsProps) => {
    const actions = {
        approve: props.onApprove,
        reject: props.onReject,
        changeBasis: props.onChangeBasis,
    }
    return (
        <>
            <Section
                kind="list"
                title={props.view.title}
                headingLevel={3}
                isLoading={props.isLoading}
                items={props.view.rows.map((row) => itemOf(row, props.view.moreMenuLabel, actions))}
                empty={<EmptyNotice message={props.view.emptyMessage} description={props.view.emptyBody} />}
            />
            {props.view.more === null ? null : (
                <Link href={props.view.moreHref}>{`${props.view.more} · ${props.view.moreLabel}`}</Link>
            )}
        </>
    )
}
