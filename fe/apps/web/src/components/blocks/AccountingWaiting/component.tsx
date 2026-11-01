import {
    Alert,
    Badge,
    Button,
    DropdownMenu,
    EmptyNotice,
    IconButton,
    ListRow,
    Stack,
    SurfaceListCard,
    Text,
    TextAction,
    Textarea,
} from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AccountingPanelBaseProps } from "@/modules/types"

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

/** The resolved words and rows of the card. */
export interface AccountingWaitingView {
    readonly title: string
    readonly count: string | null
    readonly rows: ReadonlyArray<AccountingWaitingRow>
    readonly more: string | null
    readonly moreLabel: string
    readonly moreHref: string
    readonly moreMenuLabel: string
    readonly emptyMessage: string
    readonly emptyBody: string
}

/** What the card does, addressed to a question. */
export interface AccountingWaitingOn {
    readonly approve: (id: string) => void
    readonly reject: (id: string) => void
    readonly changeBasis: (id: string, value: string) => void
}

/** Props for {@link AccountingWaitingBase}: the card read status, its placeholder of the same shape and what it does. */
export type AccountingWaitingBaseProps = AccountingPanelBaseProps<AccountingWaitingView, AccountingWaitingOn>

/** What a row draws: the question, and the view and commands it is decided with. */
interface WaitingRowProps {
    readonly row: AccountingWaitingRow
    readonly moreMenuLabel: string
    readonly on: AccountingWaitingOn
}

/**
 * One waiting question: one visible Approve (an alternative button, never a commit in a row) with Reject in the menu; under the
 * copy the amount, the basis to write, an error, or who the question waits for when the member may not decide it.
 */
const WaitingRow = (props: WaitingRowProps) => {
    const { row, on } = props
    return (
        <ListRow
            title={row.title}
            description={row.summary}
            badges={<Badge tone={row.tone}>{row.status}</Badge>}
            actions={
                row.canAct ? (
                    <>
                        <Button
                            size="sm"
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
                                    label={props.moreMenuLabel}
                                    intent="neutral"
                                    isDisabled={row.isBusy}
                                />
                            }
                            entries={[
                                {
                                    id: "reject",
                                    label: row.rejectLabel,
                                    tone: "danger",
                                    onAction: () => on.reject(row.id),
                                },
                            ]}
                        />
                    </>
                ) : undefined
            }
        >
            <Stack gap="inline">
                {row.amount === null ? null : (
                    <Text size="sm" weight="medium">
                        {row.amount}
                    </Text>
                )}
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
        </ListRow>
    )
}

/** Draws the oldest questions the Accounting agent waits on a person for, each decided in place. */
export const AccountingWaitingBase = (props: AccountingWaitingBaseProps) => (
    <SlotView {...props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => (
            <SurfaceListCard
                label={view.title}
                isLoading={isSkeleton}
                labelEnd={
                    view.count === null ? undefined : (
                        <Badge tone="warning" isDot>
                            {view.count}
                        </Badge>
                    )
                }
                empty={<EmptyNotice message={view.emptyMessage} description={view.emptyBody} />}
                footer={
                    view.more === null ? undefined : (
                        <TextAction size="sm" href={view.moreHref}>
                            {`${view.more} · ${view.moreLabel}`}
                        </TextAction>
                    )
                }
            >
                {view.rows.map((row) => (
                    <WaitingRow key={row.id} row={row} moreMenuLabel={view.moreMenuLabel} on={props.on} />
                ))}
            </SurfaceListCard>
        )}
    </SlotView>
)
