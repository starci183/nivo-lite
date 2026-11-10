import { Badge, DropdownMenu, EmptyNotice, IconButton, ListBox, PaneSection, SearchField, Tabs } from "@starci/grammar/common"
import type { IconSource, ListBoxItem, ListBoxSection } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ChannelAvatar } from "@/components/leaves/ChannelAvatar"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ALL_OPTION } from "@/modules/inbox"
import { SEARCH_CLASS_NAME, TOOLBAR_CLASS_NAME } from "./classNames"
import type { InboxCopy } from "@/modules/inbox"
import type { InboxLeadRowView, InboxListView, InboxOptionView } from "@/modules/types"

/** Props for {@link InboxLeadList}. */
export interface InboxLeadListProps {
    readonly props: {
        readonly copy: InboxCopy
        readonly list: InboxListView
        /** The words of the controls every list shares. */
        readonly pane: {
            readonly retry: string
            readonly clearSearch: string
            readonly moreFilters: string
        }
        readonly isLoading: boolean
        readonly isFailed: boolean
    }
    readonly on: {
        readonly setTab: (id: string) => void
        readonly setQuery: (value: string) => void
        readonly setChannel: (id: string) => void
        readonly setAgent: (id: string) => void
        readonly setSort: (id: string) => void
        readonly select: (id: string) => void
        readonly refresh: () => void
        readonly openConnections: () => void
    }
}

/** Five resting rows: the skeleton keeps the geometry of the ready list. */
const PLACEHOLDER: ReadonlyArray<ListBoxItem> = ["a", "b", "c", "d", "e"].map((id) => ({
    id,
    label: "",
    description: "",
    descriptionLines: 2 as const,
}))

/** One customer: the avatar with its channel badge, the name and time, two lines of what they want, their marks and the agent that owns them. */
const itemOf = (row: InboxLeadRowView): ListBoxItem => ({
    id: row.id,
    label: row.name,
    description: row.summary,
    descriptionLines: 2,
    leading: <ChannelAvatar name={row.name} seed={row.id} badge={row.channelBadge} channelLabel={row.channelLabel} />,
    meta: row.time,
    footer: (
        <>
            {row.chips.map((chip) => (
                <Badge key={chip.key} tone={chip.tone}>
                    {chip.label}
                </Badge>
            ))}
        </>
    ),
    ...(row.agent === null
        ? {}
        : { trailing: <AgentMark label={row.agent.name} seed={row.agent.id} src={row.agent.avatarUrl} size="xs" /> }),
})

/** The rows under their day captions, in the order of the day. */
const sectionsOf = (rows: ReadonlyArray<InboxLeadRowView>, copy: InboxCopy): ReadonlyArray<ListBoxSection> =>
    (
        [
            ["today", copy.sectionToday],
            ["yesterday", copy.sectionYesterday],
            ["earlier", copy.sectionEarlier],
        ] as const
    )
        .map(([section, label]) => ({
            id: section,
            label,
            items: rows.filter((row) => row.section === section).map(itemOf),
        }))
        .filter((section) => section.items.length > 0)

/** One filter of the toolbar: an icon button that opens the choices of the filter; it is active while a choice other than every one is made. */
const FilterMenu = (props: {
    readonly label: string
    readonly icon: IconSource
    readonly options: ReadonlyArray<InboxOptionView>
    readonly value: string
    readonly onChange: (id: string) => void
}) => (
    <DropdownMenu
        trigger={
            <IconButton
                intent="neutral"
                source={props.icon}
                label={props.label}
                isActive={props.value !== ALL_OPTION}
            />
        }
        entries={[
            {
                kind: "section",
                id: "choices",
                label: props.label,
                items: props.options.map((option) => ({ id: option.id, label: option.label })),
                selection: {
                    mode: "single",
                    selectedIds: [props.value],
                    onChange: (ids) => {
                        const id = ids[0]
                        if (id !== undefined) props.onChange(id)
                    },
                },
            },
        ]}
    />
)

/** The tabs with their counts; their line is the band's one separator. */
const TabsBand = (props: InboxLeadListProps) => {
    const { copy, list, pane } = props.props
    return (
        <PaneSection>
            <Tabs
                kind="filter"
                label={copy.tabsLabel}
                selectedKey={list.selectedTab}
                onSelect={props.on.setTab}
                items={list.tabs}
                moreLabel={(count) => pane.moreFilters.replace("{count}", String(count))}
                inset="none"
            />
        </PaneSection>
    )
}

/** The search and the three filters (channel, agent, order) in ONE row, the filters icon-sized. */
const ToolbarBand = (props: InboxLeadListProps) => {
    const { copy, list, pane } = props.props
    return (
        <PaneSection>
            <div className={TOOLBAR_CLASS_NAME}>
                <div className={SEARCH_CLASS_NAME}>
                    <SearchField
                        label={copy.searchLabel}
                        isLabelHidden
                        placeholder={copy.searchPlaceholder}
                        clearLabel={pane.clearSearch}
                        value={list.query}
                        onValueChange={props.on.setQuery}
                        onClear={() => props.on.setQuery("")}
                    />
                </div>
                <FilterMenu
                    label={copy.filterChannel}
                    icon={nivoIconSource("chat", "leading")}
                    options={list.channels}
                    value={list.channel}
                    onChange={props.on.setChannel}
                />
                <FilterMenu
                    label={copy.filterAgent}
                    icon={nivoIconSource("agentos", "leading")}
                    options={list.agents}
                    value={list.agent}
                    onChange={props.on.setAgent}
                />
                <FilterMenu
                    label={copy.filterSort}
                    icon={nivoIconSource("filter", "leading")}
                    options={list.sorts}
                    value={list.sort}
                    onChange={props.on.setSort}
                />
            </div>
        </PaneSection>
    )
}

/** What an empty list says: that nothing matches the filters, or that no customer has come yet, with the way to the connections. */
const EmptyRows = (props: InboxLeadListProps) => {
    const { copy, list } = props.props
    const isFiltered =
        list.selectedTab !== "all" || list.query !== "" || list.channel !== ALL_OPTION || list.agent !== ALL_OPTION
    return isFiltered ? (
        <EmptyNotice
            message={copy.noMatchTitle}
            frame="frameless"
            description={copy.noMatchBody}
            iconSource={nivoIconSource("search", "leading")}
        />
    ) : (
        <EmptyNotice
            message={copy.emptyTitle}
            frame="frameless"
            description={copy.emptyBody}
            iconSource={nivoIconSource("email", "leading")}
            actionLabel={copy.emptyAction}
            actionEndArrow
            actionIntent="neutral"
            onAction={props.on.openConnections}
        />
    )
}

/**
 * The customers of the inbox as the bands of the white list pane: the tabs with their counts (their line is the first separator), the search
 * with the three icon filters on one row, then the rows grouped by day in the pane's own scroll band. A row opens its customer; the bands
 * keep their geometry while the rows load.
 */
export const InboxLeadList = (props: InboxLeadListProps) => {
    const { copy, list, pane } = props.props
    return (
        <>
            <TabsBand {...props} />
            <ToolbarBand {...props} />
            <PaneSection
                scroll={{ label: copy.listLabel }}
                isLoading={props.props.isLoading}
                {...(props.props.isFailed
                    ? {
                          error: {
                              message: copy.errorTitle,
                              description: copy.errorBody,
                              actionLabel: pane.retry,
                              onAction: props.on.refresh,
                          },
                      }
                    : {})}
            >
                <ListBox
                    label={copy.listLabel}
                    selectionMode="single"
                    selectionIndicator="none"
                    selectedIds={list.selectedId === null ? [] : [list.selectedId]}
                    onAction={props.on.select}
                    onSelectionChange={(ids) => {
                        const id = ids[0] ?? list.selectedId
                        if (id !== null) props.on.select(id)
                    }}
                    isLoading={props.props.isLoading}
                    emptyContent={<EmptyRows {...props} />}
                    {...(props.props.isLoading ? { items: PLACEHOLDER } : { sections: sectionsOf(list.rows, copy) })}
                />
            </PaneSection>
        </>
    )
}
