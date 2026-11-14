import {
    EmptyNotice,
    Grid,
    Page,
    Stack,
    SurfaceCard,
    Text,
    type FooterZone,
    type HeaderZone,
} from "@starci/grammar/common"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { CritiqueTodoCard } from "@/components/composites/CritiqueTodoCard"
import { ConflictDrawer } from "@/components/composites/ConflictDrawer"
import { FactDetailDrawer } from "@/components/composites/FactDetailDrawer"
import { BrainInboxRail } from "@/components/composites/BrainInboxRail"
import { FactPickTable } from "@/components/composites/FactPickTable"
import { PickSelectionBar } from "@/components/composites/PickSelectionBar"
import { FactFormDrawer } from "@/components/frames/FactFormDrawer"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { BrainPageHeaderView, CritiqueTodoView, InboxCopy, InboxView } from "@/modules/types"

/** Props for {@link BrainTodoBase}. */
export interface BrainTodoBaseProps {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly copy: InboxCopy
        readonly inbox: InboxView
        /** The documents with questions of the critic waiting for the owner. */
        readonly critique: CritiqueTodoView
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly setTrust: (id: string) => void
        readonly setGrouping: (id: string) => void
        readonly retry: () => void
        readonly openSources: () => void
        readonly dismissAsk: (id: string) => void
        readonly toggleRow: (key: string) => void
        readonly toggleGroup: (groupId: string) => void
        readonly toggleOpen: (groupId: string) => void
        readonly clear: () => void
        readonly askApprove: () => void
        readonly askReject: () => void
        readonly cancel: () => void
        readonly confirm: () => void
        readonly open: (factId: string) => void
        readonly closeDetail: () => void
        readonly edit: () => void
        readonly approve: () => void
        readonly reject: () => void
        readonly menu: (id: string) => void
        readonly confirmRetire: () => void
        readonly cancelRetire: () => void
        readonly compare: (key: string) => void
        readonly closeConflict: () => void
        readonly choose: (id: string) => void
        readonly confirmChoice: () => void
    }
}

/** The zones above the fresh facts: the selection bar first, then the trust filter, then the grouping. */
const freshHeadersOf = (props: BrainTodoBaseProps): ReadonlyArray<HeaderZone> => {
    const { copy, inbox } = props.props
    const picked: ReadonlyArray<HeaderZone> =
        inbox.bar.count === 0
            ? []
            : [
                  {
                      kind: "custom",
                      children: (
                          <PickSelectionBar
                              props={{ bar: inbox.bar, confirm: inbox.confirm }}
                              on={{
                                  clear: props.on.clear,
                                  askReject: props.on.askReject,
                                  askApprove: props.on.askApprove,
                                  cancel: props.on.cancel,
                                  confirm: props.on.confirm,
                              }}
                          />
                      ),
                  },
              ]
    return [
        ...picked,
        {
            kind: "filter",
            label: copy.trustFilterLabel,
            items: [
                { id: "all", label: copy.trustAll, count: inbox.trustCounts.all },
                { id: "high", label: copy.trustHighOnly, count: inbox.trustCounts.high },
            ],
            selectedKey: inbox.trust,
            onSelect: props.on.setTrust,
        },
        {
            kind: "switch",
            label: copy.groupingLabel,
            title: inbox.bar.hint,
            items: [
                { id: "document", label: copy.byDocument },
                { id: "subject", label: copy.bySubject },
            ],
            selectedKey: inbox.grouping,
            onSelect: props.on.setGrouping,
        },
    ]
}

/** The merged values, said once under the card they belong to. */
const mergedFooter = (note: string | null): ReadonlyArray<FooterZone> =>
    note === null
        ? []
        : [
              {
                  kind: "custom",
                  children: (
                      <Text size="xs" tone="muted">
                          {note}
                      </Text>
                  ),
              },
          ]

/** The values that differ, one row each with its comparison: nothing of them is used until the owner chooses. */
const Conflicts = (props: BrainTodoBaseProps) => {
    const { copy, inbox } = props.props
    if (inbox.conflicts.length === 0) return null
    return (
        <SurfaceCard
            kind="list"
            label={copy.conflictsTitle}
            count={inbox.conflicts.length}
            isAttention
            note={copy.conflictsFact}
            items={inbox.conflicts.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.line,
                leading: { icon: nivoIconSource("warning", "leading") },
                ...(row.badge === null ? {} : { badges: [{ label: row.badge, tone: "neutral" as const }] }),
                actionPlacement: "end" as const,
                action: { label: copy.compare, press: () => props.on.compare(row.id) },
            }))}
            footers={mergedFooter(inbox.mergedNote)}
            empty={null}
        />
    )
}

/** The main column: the conflicts, then the fresh facts to tick by document or subject; one notice when nothing waits. */
const Main = (props: BrainTodoBaseProps) => {
    const { copy, inbox } = props.props
    const isWaiting = inbox.isWaiting
    const hasQuestions = "items" in props.props.critique.slot || "isLoading" in props.props.critique.slot
    if (!isWaiting && !hasQuestions && inbox.conflicts.length === 0 && inbox.total === 0) {
        return (
            <EmptyNotice
                message={copy.inboxEmptyTitle}
                description={copy.inboxEmptyBody}
                actionLabel={copy.inboxEmptyAction}
                actionIntent="neutral"
                actionEndArrow
                onAction={props.on.openSources}
                iconSource={nivoIconSource("brain", "leading")}
            />
        )
    }
    return (
        <Stack gap="section">
            <CritiqueTodoCard props={{ critique: props.props.critique }} on={{ retry: props.on.retry }} />
            <Conflicts {...props} />
            {inbox.total === 0 && !isWaiting ? null : (
                <FactPickTable
                    props={{
                        copy: copy.table,
                        fact: String(inbox.total),
                        groups: inbox.groups,
                        headers: freshHeadersOf(props),
                        footers: inbox.conflicts.length === 0 ? mergedFooter(inbox.mergedNote) : [],
                        canWrite: inbox.canWrite,
                        isLoading: isWaiting,
                    }}
                    on={{
                        toggleRow: props.on.toggleRow,
                        toggleGroup: props.on.toggleGroup,
                        toggleOpen: props.on.toggleOpen,
                        open: props.on.open,
                        compare: props.on.compare,
                    }}
                />
            )}
        </Stack>
    )
}

/** What the notice of a failed read draws. */
interface FailedProps {
    readonly copy: InboxCopy
    readonly onRetry: () => void
}

/** The page's notice when the read failed, with its retry. */
const Failed = (props: FailedProps) => (
    <EmptyNotice
        isError
        iconSource={nivoIconSource("failure", "leading")}
        message={props.copy.errorTitle}
        description={props.copy.errorBody}
        actionLabel={props.copy.retry}
        onAction={props.onRetry}
    />
)

/**
 * The to-do tab: the Second Brain header with its four tabs, then the one inbox. The main column holds the values that differ (each
 * only compared, never ticked) and the fresh facts ticked by document, subject or row with the selection bar at the top; the rail holds
 * the progress, the customer questions without an answer and the public texts waiting. Drawers open a fact or a comparison.
 */
export const BrainTodoBase = (props: BrainTodoBaseProps) => {
    const { header, inbox, copy } = props.props
    return (
        <Page
            header={{
                ...header.heading,
                actions: <BrainHeaderActions add={header.actions.add} />,
                tabs: brainHeaderTabs({ tabs: header.tabs, onSelect: props.on.selectTab }),
            }}
            measure="product"
        >
            {inbox.isFailed ? (
                <Failed copy={copy} onRetry={props.on.retry} />
            ) : (
                <Grid
                    kind="main-rail"
                    railWidth="medium"
                    align="start"
                    primary={<Main {...props} />}
                    rail={<BrainInboxRail props={{ copy, inbox }} on={{ dismissAsk: props.on.dismissAsk }} />}
                />
            )}
            <ConflictDrawer
                props={{ view: inbox.conflict }}
                on={{ close: props.on.closeConflict, choose: props.on.choose, confirm: props.on.confirmChoice }}
            />
            <FactDetailDrawer
                props={{ view: inbox.detail }}
                on={{
                    close: props.on.closeDetail,
                    edit: props.on.edit,
                    approve: props.on.approve,
                    reject: props.on.reject,
                    menu: props.on.menu,
                    confirmRetire: props.on.confirmRetire,
                    cancelRetire: props.on.cancelRetire,
                }}
            />
            {inbox.factDrawer === null ? null : <FactFormDrawer {...inbox.factDrawer} />}
        </Page>
    )
}
