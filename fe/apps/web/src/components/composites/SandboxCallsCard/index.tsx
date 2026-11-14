import { Button, Cluster, SurfaceCard, Text, type FooterZone, type ListRowData } from "@starci/grammar/common"
import { sandboxCardStateOf } from "@/components/branches/SandboxCardState"
import type { DataSlot, SandboxCallRowView, SandboxCallsData, SandboxCopy, SandboxPendingView } from "@/modules/types"

/** What the call log card draws and does. */
interface SandboxCallsCardProps {
    readonly copy: SandboxCopy
    readonly slot: DataSlot<SandboxCallsData>
    readonly pending: SandboxPendingView
    readonly on: {
        readonly more: () => void
        readonly askClear: () => void
        readonly retry: () => void
    }
}

/** The card while its log is read: three rows of the shape of the real ones. */
const PLACEHOLDER: SandboxCallsData = {
    rows: ["a", "b", "c"].map((id) => ({ id: `call:${id}`, title: " ", line: " ", isFailed: false })),
    hasMore: false,
}

/** No call at all. */
const NONE: SandboxCallsData = { rows: [], hasMore: false }

/** One call as a row: what was called or sent, then the case, the moment and, for a call that threw, why; a plain Badge marks the failure. */
const rowOf = (row: SandboxCallRowView, failedBadge: string): ListRowData => ({
    id: row.id,
    title: row.title,
    description: (
        <Text as="span" size="xs" tone="muted">
            {row.line}
        </Text>
    ),
    ...(row.isFailed ? { badges: [{ label: failedBadge }] as const } : {}),
})

/** The zones under the rows: the way to read older calls, and the neutral command that clears the log (only when there is a log). */
const footersOf = (data: SandboxCallsData, props: SandboxCallsCardProps): ReadonlyArray<FooterZone> => [
    ...(data.hasMore ? [{ kind: "more" as const, label: props.copy.calls.moreLabel, press: props.on.more }] : []),
    ...(data.rows.length === 0
        ? []
        : [
              {
                  kind: "custom" as const,
                  children: (
                      <Cluster gap="row" justify="end">
                          <Button
                              intent="neutral"
                              size="sm"
                              isPending={props.pending.isClearing}
                              onPress={props.on.askClear}
                          >
                              {props.copy.calls.clearLabel}
                          </Button>
                      </Cluster>
                  ),
              },
          ]),
]

/** The calls the open account answered or received, newest first, a page at a time; clearing the log asks first (the page owns the question). */
export const SandboxCallsCard = (props: SandboxCallsCardProps) => {
    const state = sandboxCardStateOf(props.slot, PLACEHOLDER, NONE, {
        message: props.copy.calls.errorTitle,
        retryLabel: props.copy.retryLabel,
        onRetry: props.on.retry,
    })
    const footers = state.isLoading || state.error !== undefined ? [] : footersOf(state.data, props)
    return (
        <SurfaceCard
            kind="list"
            label={props.copy.calls.title}
            headingLevel={2}
            isLoading={state.isLoading}
            {...(state.error === undefined ? {} : { error: state.error })}
            {...(footers.length === 0 ? {} : { footers })}
            items={state.data.rows.map((row) => rowOf(row, props.copy.calls.failedBadge))}
            empty={<Text tone="muted">{props.copy.calls.empty}</Text>}
        />
    )
}
