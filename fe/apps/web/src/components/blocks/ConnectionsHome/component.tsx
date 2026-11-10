import { useState } from "react"
import { Badge, Button, Cluster, EmptyNotice, IdentityLockup, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { Figure, ListRowData, TableRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionLastEvent } from "@/components/composites/ConnectionLastEvent"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ConnectionListRow, ConnectionsListView, DataSlot, SlotLabels } from "@/modules/types"

/** The words of the Connected tab. */
interface ConnectionsHomeCopy {
    readonly attentionHeading: string
    readonly figuresLabel: string
    readonly running: string
    readonly runningMeta: string
    readonly waiting: string
    readonly waitingMeta: string
    readonly needs: string
    readonly needsMeta: string
    readonly agents: string
    readonly agentsMeta: string
    readonly allHeading: string
    readonly colConnection: string
    readonly colLastEvent: string
    readonly colAgent: string
    readonly lastEventNone: string
    readonly lastEventFailed: string
    readonly agentNone: string
    readonly filterLabel: string
    /** "{count} more filters": the name of the fold menu, with the count in place. */
    readonly moreFilters: string
    readonly searchLabel: string
    readonly clearLabel: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly forbiddenBody: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    /** The pager under the table: its landmark, its two arrows, one page button and the "from–to of total" summary. */
    readonly paging: {
        readonly nav: string
        readonly previous: string
        readonly next: string
        readonly page: (page: number) => string
        readonly summary: (from: number, to: number, total: number) => string
    }
}

/** A provider connected after the agents were made, asking once whether to attach it by template. */
export interface PendingAttachmentView {
    readonly id: string
    readonly title: string
    readonly body: string
    readonly name: string
    readonly logo: string | undefined
    readonly laterLabel: string
    readonly attachLabel: string
}

/** The words, the read and the controls of the Connected tab. */
export interface ConnectionsHomeBaseProps {
    readonly props: {
        readonly copy: ConnectionsHomeCopy
        readonly locale: string
        readonly slot: DataSlot<ConnectionsListView>
        readonly labels: SlotLabels
        /** The rows the search and the filter leave. */
        readonly rows: ReadonlyArray<ConnectionListRow>
        readonly filter: string
        readonly text: string
        /** The providers waiting for "attach by template?" (a FAKE source today). */
        readonly pending: ReadonlyArray<PendingAttachmentView>
    }
    readonly on: {
        readonly later: (id: string) => void
        readonly attachByTemplate: (id: string) => void
        readonly goTo: (href: string) => void
        readonly openLibrary: () => void
        readonly retry: () => void
        readonly filter: (value: string) => void
        readonly text: (value: string) => void
        readonly clearFilters: () => void
    }
}

/** How many connections one page of the table holds. */
const PAGE_SIZE = 10

/** The geometry of a ready page: the figures and five rows keep their cells while the read waits. */
const PLACEHOLDER: ConnectionsListView = {
    rows: ["a", "b", "c", "d", "e"].map((id) => ({
        id,
        name: "",
        description: "",
        logo: { isWordmark: false },
        status: { label: "", tone: "neutral" as const, isDot: false },
        href: "",
        groups: [],
        lastEventAt: null,
        isFailed: false,
        agents: "",
    })),
    filters: [{ value: "all", label: "", count: 0 }],
    summary: "",
    liveCount: 1,
    attention: [],
    figures: { total: 0, running: 0, waiting: 0, attention: 0, agentsUsing: 0, agentsTotal: 0 },
    canManage: false,
}

type Props = ConnectionsHomeBaseProps

/** The four health figures: what runs, what waits for its first event, what needs the owner, and the agents that use a connection. */
const figuresOf = (copy: ConnectionsHomeCopy, view: ConnectionsListView): ReadonlyArray<Figure> => [
    { id: "running", term: copy.running, value: view.figures.running, meta: copy.runningMeta },
    { id: "waiting", term: copy.waiting, value: view.figures.waiting, meta: copy.waitingMeta },
    { id: "needs", term: copy.needs, value: view.figures.attention, meta: copy.needsMeta },
    { id: "agents", term: copy.agents, value: view.figures.agentsUsing, meta: copy.agentsMeta },
]

/** One row per connection that needs the owner: its mark, what happened, what it stops, and its one action. */
const attentionRowsOf = (props: Props, view: ConnectionsListView): ReadonlyArray<ListRowData> =>
    view.attention.map((step): ListRowData => {
        const action = step.action
        return {
            id: step.id,
            title: step.title,
            description: step.body,
            leading: {
                avatar: {
                    name: step.name,
                    ...(step.logo.src === undefined ? {} : { src: step.logo.src }),
                    shape: "square",
                },
                size: "md",
            },
            actionPlacement: "end",
            ...(action === null
                ? {}
                : {
                      action: {
                          label: action.label,
                          intent: action.isPrimary ? "commit" : "neutral",
                          isPrimary: action.isPrimary,
                          press: () => props.on.goTo(action.href),
                      },
                  }),
        }
    })

/** One row per provider that waits for "attach by template?": its mark, the question, and two neutral small pills. */
const pendingRowsOf = (props: Props): ReadonlyArray<ListRowData> =>
    props.props.pending.map(
        (row): ListRowData => ({
            id: `pending:${row.id}`,
            title: row.title,
            description: row.body,
            leading: {
                avatar: { name: row.name, ...(row.logo === undefined ? {} : { src: row.logo }), shape: "square" },
                size: "md",
            },
            detail: (
                <Cluster gap="inline">
                    <Button size="sm" intent="neutral" onPress={() => props.on.later(row.id)}>
                        {row.laterLabel}
                    </Button>
                    <Button size="sm" intent="neutral" onPress={() => props.on.attachByTemplate(row.id)}>
                        {row.attachLabel}
                    </Button>
                </Cluster>
            ),
        }),
    )

/** One table row per connection: the lockup with its status, the last event and the agents; the whole row opens its page. */
const tableRowsOf = (data: Props["props"]): ReadonlyArray<TableRowData> => {
    const { copy } = data
    return data.rows.map((row) => ({
        id: row.id,
        href: row.href,
        cells: {
            connection: (
                <Cluster gap="inline" wrap>
                    <IdentityLockup
                        title={row.name}
                        subtitle={row.description}
                        {...(row.logo.src === undefined ? {} : { logoSrc: row.logo.src })}
                        markShape="rounded"
                    />
                    {row.status.label === "" ? null : (
                        <Badge tone={row.status.tone} isDot={row.status.isDot}>
                            {row.status.label}
                        </Badge>
                    )}
                </Cluster>
            ),
            lastEvent: (
                <ConnectionLastEvent
                    at={row.lastEventAt}
                    outcome={row.isFailed ? "failed" : "ok"}
                    locale={data.locale}
                    failedLabel={copy.lastEventFailed}
                    noneLabel={copy.lastEventNone}
                />
            ),
            agent: (
                <Text size="sm" overflow="truncate">
                    {row.agents === "" ? copy.agentNone : row.agents}
                </Text>
            ),
        },
    }))
}

/** What the body draws: the view, and whether it is the placeholder of the first read. */
interface BodyProps {
    /** The tab's words, rows and controls, as the tab received them. */
    readonly home: Props
    readonly view: ConnectionsListView
    readonly isLoading: boolean
}

/** The page body: the connections that need the owner, the health figures, then every connection with its filters and search. */
const Body = (input: BodyProps) => {
    const props = input.home
    const { copy } = props.props
    const { view } = input
    const [page, setPage] = useState(1)
    const total = props.props.rows.length
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const current = Math.min(page, pageCount)
    const from = (current - 1) * PAGE_SIZE
    const pageRows = { ...props.props, rows: props.props.rows.slice(from, from + PAGE_SIZE) }
    return (
        <Stack gap="region">
            {view.attention.length === 0 && props.props.pending.length === 0 ? null : (
                <Section
                    kind="list"
                    title={copy.attentionHeading}
                    count={view.attention.length + props.props.pending.length}
                    items={[...pendingRowsOf(props), ...attentionRowsOf(props, view)]}
                    empty={null}
                    isLoading={input.isLoading}
                />
            )}
            <SurfaceCard
                kind="figures"
                ariaLabel={copy.figuresLabel}
                items={figuresOf(copy, view)}
                isLoading={input.isLoading}
            />
            <SurfaceCard
                kind="table"
                label={copy.allHeading}
                count={view.rows.length}
                isLoading={input.isLoading}
                headers={[
                    {
                        kind: "filter",
                        label: copy.filterLabel,
                        items: view.filters.map((choice) => ({
                            id: choice.value,
                            label: choice.label,
                            count: choice.count,
                            ...(choice.value === "attention" && choice.count > 0 ? { isAttention: true } : {}),
                        })),
                        selectedKey: props.props.filter,
                        onSelect: props.on.filter,
                        moreLabel: (count) => copy.moreFilters.replace("{count}", String(count)),
                    },
                    {
                        kind: "search",
                        label: copy.searchLabel,
                        placeholder: copy.searchLabel,
                        clearLabel: copy.clearLabel,
                        value: props.props.text,
                        onChange: props.on.text,
                    },
                ]}
                columns={[
                    { id: "connection", label: copy.colConnection },
                    { id: "lastEvent", label: copy.colLastEvent, priority: "low" },
                    { id: "agent", label: copy.colAgent, priority: "low" },
                ]}
                rows={tableRowsOf(pageRows)}
                footers={
                    total > 0
                        ? [
                              {
                                  kind: "paging" as const,
                                  page: current,
                                  pageCount,
                                  onPage: setPage,
                                  labels: {
                                      nav: copy.paging.nav,
                                      previous: copy.paging.previous,
                                      next: copy.paging.next,
                                      page: copy.paging.page,
                                      summary: copy.paging.summary(from + 1, Math.min(total, from + PAGE_SIZE), total),
                                  },
                              },
                          ]
                        : []
                }
                empty={
                    <EmptyNotice
                        message={copy.noMatchTitle}
                        iconSource={nivoIconSource("search", "leading")}
                        description={copy.noMatchBody}
                        actionLabel={copy.clearFilters}
                        onAction={props.on.clearFilters}
                    />
                }
            />
        </Stack>
    )
}

/**
 * Draws the Connected tab of the Connections page as one full-width column: on top the connections that need the owner, each with its
 * one action; under it the health figures; then one card of every connection with its status, last event and agents, the filter
 * chips and the search. With no connection yet it is the invitation to the library alone.
 */
export const ConnectionsHomeBase = (props: ConnectionsHomeBaseProps) => {
    const { copy, slot } = props.props
    const { on } = props
    if ("isForbidden" in slot) {
        return (
            <EmptyNotice
                message={props.props.labels.forbidden}
                description={copy.forbiddenBody}
                iconSource={nivoIconSource("code", "leading")}
            />
        )
    }
    if ("isEmpty" in slot || ("items" in slot && slot.items.liveCount === 0)) {
        return (
            <EmptyNotice
                message={props.props.labels.empty}
                description={copy.emptyBody}
                iconSource={nivoIconSource("trigger", "leading")}
                actionLabel={copy.emptyAction}
                actionEndArrow
                onAction={on.openLibrary}
            />
        )
    }
    return (
        <SlotView
            slot={slot}
            placeholder={PLACEHOLDER}
            labels={props.props.labels}
            errorDescription={copy.errorBody}
            onRetry={on.retry}
            render={(view, isLoading) => <Body home={{ props: props.props, on }} view={view} isLoading={isLoading} />}
        />
    )
}
