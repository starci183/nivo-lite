import {
    Badge,
    Cluster,
    DataTable,
    EmptyNotice,
    IconTile,
    Link,
    Pagination,
    Pane,
    PaneGrid,
    PaneSection,
    Section,
    Stack,
    SurfaceCard,
    Text,
    type DataTableRow,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { AgentKnowledgeView, SourceRowView } from "./view"

/** The words and values the connected tab supplies, and the commands it answers. */
export interface AgentKnowledgeBaseProps {
    readonly props: {
        readonly slot: DataSlot<AgentKnowledgeView>
        /** A view of the same shape as a ready one, so every card keeps its geometry while the agent is read. */
        readonly placeholder: AgentKnowledgeView
        readonly slotLabels: SlotLabels
        readonly paneLabel: string
        /** The page of the table of sources (1-based), the sources a page holds, and the words of its footer. */
        readonly page: number
        readonly pageSize: number
        readonly pagination: {
            readonly label: string
            readonly previous: string
            readonly next: string
        }
    }
    readonly on: {
        /** Opens the owner's review of the facts that wait. */
        readonly review: (href: string) => void
        readonly retry: () => void
        readonly page: (page: number) => void
        /** The accessible name of the button of one page, and the summary of the foot ("1-6 of 7 sources"). */
        readonly pageLabel: (page: number) => string
        readonly summary: (from: number, to: number, total: number) => string
    }
}

interface ViewProps {
    readonly view: AgentKnowledgeView
    readonly isLoading: boolean
}

interface SourceTableRow extends DataTableRow {
    readonly source: SourceRowView
}

/** What the first cell of a source row is given. */
interface SourceCellProps {
    readonly row: SourceRowView
}

const SourceCell = ({ row }: SourceCellProps) => (
    <Cluster gap="inline" align="center" wrap={false}>
        <IconTile source={nivoIconSource(row.icon, "leading")} tone="neutral" size="md" />
        <Stack gap="identity">
            <Text isStrong tone={row.isRead ? "default" : "muted"}>
                {row.title}
            </Text>
            <Text size="xs" tone="muted">
                {row.subline}
            </Text>
        </Stack>
    </Cluster>
)

const statusToneOf = (source: SourceRowView) => {
    if (source.hasWaiting) return "warning" as const
    return source.isRead ? ("success" as const) : ("neutral" as const)
}

const sourceCellOf = (row: SourceTableRow, columnId: string) => {
    const source = row.source
    if (columnId === "source") return <SourceCell row={source} />
    if (columnId === "kind") return <Text size="sm">{source.kindLabel}</Text>
    if (columnId === "updated") return <Text size="sm">{source.updatedLabel}</Text>
    return (
        <Badge tone={statusToneOf(source)}>
            {source.statusLabel}
        </Badge>
    )
}

/** What the table of sources is given: the view, whether it loads, and the page it stands on. */
interface SourcesTableProps extends ViewProps {
    readonly props: AgentKnowledgeBaseProps["props"]
    readonly on: AgentKnowledgeBaseProps["on"]
}

/** What the card of the facts that wait is given: the view and the command that opens their review. */
interface WaitingCardProps {
    readonly view: AgentKnowledgeView
    readonly on: AgentKnowledgeBaseProps["on"]
}

/** "Knowledge sources": a native table of what the agent reads (source, kind, updated, status) with its pagination in the grey foot. */
const SourcesTable = ({ view, isLoading, props, on }: SourcesTableProps) => {
    const { sources } = view
    const total = sources.rows.length
    const pageCount = Math.max(1, Math.ceil(total / props.pageSize))
    const page = Math.min(props.page, pageCount)
    const from = (page - 1) * props.pageSize
    const shown = sources.rows.slice(from, from + props.pageSize)
    return (
        <Section
            title={sources.title}
            headingLevel={2}
            count={total}
            isLoading={isLoading}
            action={
                <Link variant="head" href={sources.add.href}>
                    {sources.add.label}
                </Link>
            }
        >
            <DataTable
                label={sources.title}
                isLoading={isLoading}
                columns={[
                    {
                        id: "source",
                        label: sources.columns.source,
                        isRowHeader: true,
                        width: "fill",
                        minWidth: 240,
                        truncate: true,
                    },
                    { id: "kind", label: sources.columns.kind, width: "fit", hideBelow: "tablet" },
                    { id: "updated", label: sources.columns.updated, width: "fit", hideBelow: "tablet" },
                    { id: "status", label: sources.columns.status, width: "fit" },
                ]}
                rows={shown.map((source): SourceTableRow => ({ id: source.id, href: source.href, source }))}
                renderCell={sourceCellOf}
                phone="list"
                emptyContent={<EmptyNotice message={sources.empty} />}
                footer={
                    total === 0 ? undefined : (
                        <Pagination
                            label={props.pagination.label}
                            page={page}
                            pageCount={pageCount}
                            onPageChange={on.page}
                            previousLabel={props.pagination.previous}
                            nextLabel={props.pagination.next}
                            pageLabel={on.pageLabel}
                            summary={on.summary(from + 1, from + shown.length, total)}
                        />
                    )
                }
            />
        </Section>
    )
}

/** What waits for the owner before the agent may use it: one attention card (what, why, the one action). */
const WaitingCard = ({ view, on }: WaitingCardProps) => {
    const banner = view.banner
    if (banner === null) return null
    return (
        <SurfaceCard
            kind="list"
            label={banner.heading}
            headingLevel={2}
            fact={banner.count}
            empty={null}
            items={[
                {
                    id: "waiting",
                    title: banner.title,
                    description: banner.body,
                    leading: { icon: nivoIconSource("review", "leading") },
                    actionPlacement: "end",
                    action: {
                        label: banner.label,
                        intent: "commit",
                        isPrimary: true,
                        press: () => on.review(banner.href),
                    },
                },
            ]}
        />
    )
}

/** "Sample answers": the facts only this agent reads, as a list of question and answer; the head link writes a new one. */
const AnswersList = ({ view, isLoading }: ViewProps) => (
    <Section
        kind="list"
        title={view.answers.title}
        headingLevel={2}
        count={view.answers.rows.length}
        isLoading={isLoading}
        action={
            <Link variant="head" href={view.answers.add.href}>
                {view.answers.add.label}
            </Link>
        }
        items={view.answers.rows.map((row) => ({
            id: row.id,
            title: row.question,
            description: row.answer,
            ...(row.waitingLabel === ""
                ? {}
                : { badges: [{ label: row.waitingLabel, tone: "warning" as const }] as const }),
        }))}
        empty={<EmptyNotice message={view.answers.empty} />}
    />
)

/** Draws the Knowledge tab of an agent as one well: what waits for the owner, the table of sources and the list of sample answers. */
export const AgentKnowledgeBase = (props: AgentKnowledgeBaseProps) => {
    const { props: view, on } = props
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.slotLabels}
            onRetry={on.retry}
            render={(content, isLoading) => (
                <PaneGrid label={view.paneLabel} areas={{ base: ["well"] }} columns={{ base: ["fill"] }}>
                    <Pane area="well" scroll label={view.paneLabel}>
                        <PaneSection gap="section">
                            <WaitingCard view={content} on={on} />
                            <SourcesTable view={content} isLoading={isLoading} props={view} on={on} />
                            <AnswersList view={content} isLoading={isLoading} />
                        </PaneSection>
                    </Pane>
                </PaneGrid>
            )}
        />
    )
}
