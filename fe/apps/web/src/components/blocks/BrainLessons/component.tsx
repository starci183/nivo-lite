import { Alert, Button, Cluster, Icon, IconTile, Select, Stack } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { LessonDetail } from "@/components/composites/LessonDetail"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { BrainPanes } from "@/components/frames/BrainPanes"
import { LessonFormDrawer } from "@/components/frames/LessonFormDrawer"
import { filterChoiceOf } from "@/components/composites/FilterGroup"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { BrainPageHeaderView, LessonDrawerView, LessonEntryView, LessonsView } from "@/modules/types"

/** The words of the lessons page. */
interface LessonsCopy {
    readonly grid: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly filterLabel: string
    readonly moreFilters: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly back: string
}

/** Props for {@link BrainLessonsBase}. */
export interface BrainLessonsBaseProps {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly panelId: string
        readonly copy: LessonsCopy
        readonly lessons: LessonsView
        /** The drawer that writes a lesson by hand, which the address may open over the list. */
        readonly drawer: LessonDrawerView | null
    }
    readonly on: {
        readonly reviewAll: () => void
        readonly selectTab: (id: string) => void
        readonly setFilter: (id: string) => void
        readonly setAgent: (value: string | null) => void
        readonly mine: () => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly retry: () => void
        readonly add: () => void
        readonly act: (entryId: string, actionId: string) => void
    }
}

/** The list rows: the lesson and what it asks for, its status at the end. */
const itemsOf = (entries: ReadonlyArray<LessonEntryView>): ReadonlyArray<ListBoxItem> =>
    entries.map((entry) => ({
        id: entry.id,
        label: entry.title,
        description: entry.line,
        leading: <IconTile source={nivoIconSource("talents", "leading")} tone="neutral" />,
        trailing: <RowTrailing badge={entry.badge} />,
    }))

/** The agent the list is about, and the command that studies its corrections. */
const AgentRow = (props: BrainLessonsBaseProps) => {
    const agent = props.props.lessons.agent
    return (
        <Cluster gap="inline" align="center" wrap={false}>
            <Select
                label={agent.label}
                appearance="pill"
                options={agent.options}
                value={agent.value}
                onValueChange={props.on.setAgent}
            />
            {agent.canMine ? (
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={agent.isMining}
                    startContent={<Icon source={nivoIconSource("talents", "leading")} usage="leading" />}
                    onPress={props.on.mine}
                >
                    {agent.mineLabel}
                </Button>
            ) : null}
        </Cluster>
    )
}

/** The list pane: the agent and the study command, the status tabs, then the rows. */
const ListBody = (props: BrainLessonsBaseProps) => {
    const { copy, lessons } = props.props
    return (
        <SlotView
            slot={lessons.slot}
            placeholder={lessons.placeholder}
            labels={lessons.slotLabels}
            errorDescription={copy.errorBody}
            emptyDescription={copy.emptyBody}
            onRetry={props.on.retry}
            render={(entries, isLoading) => (
                <Stack gap="row">
                    {lessons.notice === null ? null : <Alert tone="informative" title={lessons.notice} />}
                    <AgentRow {...props} />
                    <PaneList
                        label={copy.listLabel}
                        choice={filterChoiceOf(
                            lessons.filters,
                            lessons.filter,
                            { label: copy.filterLabel, moreLabel: copy.moreFilters },
                            props.on.setFilter,
                        )}
                        items={itemsOf(entries)}
                        selectedId={lessons.selectedId}
                        onSelect={props.on.select}
                        empty={{
                            message: copy.noMatchTitle,
                            description: copy.noMatchBody,
                            actionLabel: copy.clearFilters,
                            onAction: () => props.on.setFilter("all"),
                        }}
                        isLoading={isLoading}
                    />
                </Stack>
            )}
        />
    )
}

/** What the opened lesson draws. */
interface OpenedProps {
    readonly entry: LessonEntryView
    readonly isWaiting: boolean
    readonly onAction: (entryId: string, actionId: string) => void
}

/** The opened lesson under its head band. */
const DetailOf = (props: OpenedProps) => (
    <PaneBody isWaiting={props.isWaiting}>
        <LessonDetail
            detail={props.entry.detail}
            isLoading={props.isWaiting}
            onAction={(actionId) => props.onAction(props.entry.id, actionId)}
        />
    </PaneBody>
)

/**
 * Draws the lessons of the Second Brain as the page of its tab: the header with its tab strip, then the panes (the lessons narrowed
 * by agent and status, and the opened lesson with the corrections it stands on and the decision about it). A phone shows the list,
 * or the opened lesson with a way back. A settled read with no lessons, or one that failed, is one notice across the page.
 */
export const BrainLessonsBase = (props: BrainLessonsBaseProps) => {
    const { copy, lessons, header, drawer } = props.props
    return (
        <BrainPanes
            header={header}
            panelId={props.props.panelId}
            copy={{ ...copy, list: copy.listLabel, detail: copy.detailLabel }}
            grid={lessons.grid}
            slot={lessons.slot}
            placeholder={lessons.placeholder}
            slotLabels={lessons.slotLabels}
            selectedId={lessons.selectedId}
            isFiltered={lessons.isFiltered}
            glyph="talents"
            on={props.on}
            list={
                <PaneBody
                    isWaiting={"isLoading" in lessons.slot}
                    overlay={drawer === null ? null : <LessonFormDrawer {...drawer} />}
                >
                    <ListBody {...props} />
                </PaneBody>
            }
            renderDetail={(entry, isWaiting) => (
                <DetailOf entry={entry} isWaiting={isWaiting} onAction={props.on.act} />
            )}
        />
    )
}
