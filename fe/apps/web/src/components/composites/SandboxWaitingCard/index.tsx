import { RelativeTime, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { sandboxCardStateOf } from "@/components/branches/SandboxCardState"
import type { DataSlot, SandboxCopy, SandboxPendingView, SandboxWaitingRowView } from "@/modules/types"

/** What the waiting runs card draws and does. */
interface SandboxWaitingCardProps {
    readonly copy: SandboxCopy
    readonly locale: string
    readonly slot: DataSlot<ReadonlyArray<SandboxWaitingRowView>>
    readonly pending: SandboxPendingView
    readonly on: {
        readonly expire: (runId: string) => void
        readonly retry: () => void
    }
}

/** The card while the runs are read: two rows of the shape of the real ones. */
const PLACEHOLDER: ReadonlyArray<SandboxWaitingRowView> = ["a", "b"].map((id) => ({
    runId: `run:${id}`,
    title: " ",
    what: " ",
    dueAt: "",
}))

/** One run as a row: who it works for over what it waits for and the time left (Grammar's countdown), and the command that ends the wait now. */
const rowOf = (row: SandboxWaitingRowView, props: SandboxWaitingCardProps): ListRowData => ({
    id: row.runId,
    title: row.title,
    description: (
        <Text as="span" size="xs" tone="muted">
            {`${row.what} · `}
            <RelativeTime
                mode="countdown"
                dateTime={row.dueAt}
                locale={props.locale}
                template={props.copy.waiting.leftTemplate}
                expiredLabel={props.copy.waiting.dueLabel}
                fallback={props.copy.waiting.dueLabel}
                size="xs"
                tone="muted"
            />
        </Text>
    ),
    actionPlacement: "end",
    action: {
        label: props.copy.waiting.expireLabel,
        press: () => props.on.expire(row.runId),
        isPending: props.pending.expiringId === row.runId,
    },
})

/**
 * The runs of the workspace parked at a wait, as the full-width block under the account: ending a wait runs the real deadline road,
 * after which the list is read again (the run may wait again on its next round, or be gone).
 */
export const SandboxWaitingCard = (props: SandboxWaitingCardProps) => {
    const state = sandboxCardStateOf(props.slot, PLACEHOLDER, [], {
        message: props.copy.waiting.errorTitle,
        retryLabel: props.copy.retryLabel,
        onRetry: props.on.retry,
    })
    return (
        <SurfaceCard
            kind="list"
            label={props.copy.waiting.title}
            headingLevel={2}
            isLoading={state.isLoading}
            {...(state.error === undefined ? {} : { error: state.error })}
            {...(state.isLoading || state.data.length === 0 ? {} : { count: state.data.length })}
            items={state.data.map((row) => rowOf(row, props))}
            empty={<Text tone="muted">{props.copy.waiting.empty}</Text>}
        />
    )
}
