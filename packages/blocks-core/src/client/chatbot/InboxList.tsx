import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Avatar, Badge, Button, Cluster, ListBox, RelativeTime, Stack, Tabs, Text } from "@starci/grammar/common"
import type { BadgeTone, ListBoxItem } from "@starci/grammar/common"
import type { inboxBlock } from "../../blocks/chatbot/inbox.block"
import { countsView, EMPTY_TAB_COUNTS, tabEntriesOf, TAB_COUNTS_PLACEHOLDER } from "../../rows/filter-tabs"
import type { TabCounts, TabSpec } from "../../rows/filter-tabs"
import { tabOf, paramsOfTab } from "../../rows/chatbot/inbox-tabs"
import { INBOX_TABS, threadRowsOf } from "../../rows/chatbot/thread-rows"
import type { ThreadListRow, ThreadStatus } from "../../rows/chatbot/thread-rows"
import { chosenRow, moreStateOf, recordsView, selectionOf } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { PaneSearch } from "../composites/PaneSearch"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the list pane is given: the inbox's own props, slots and params. */
type InboxListProps = RenderOf<typeof inboxBlock>

/** The look of a status chip: needs a person is a warning, held by a person is info, answered by the AI is neutral. */
const STATUS_TONE: Readonly<Record<ThreadStatus, BadgeTone>> = {
    needs: "warning",
    handled: "info",
    ai: "neutral",
}

/** The words of a row's chips. */
interface RowWords {
    /** The language of the viewer, for the time at the end of a row. */
    readonly locale: string
    readonly status: (row: ThreadListRow) => string
    readonly channel: (key: string) => string
}

/** The end of a row: the time over its two chips, the status with its dot and the channel. */
const trailingOf = (row: ThreadListRow, words: RowWords): ReactNode => (
    <Stack gap="inline" align="end">
        {row.at === "" ? null : <RelativeTime dateTime={row.at} locale={words.locale} size="sm" tone="muted" />}
        {row.status === null ? null : (
            <Badge tone={STATUS_TONE[row.status]} isDot>
                {words.status(row)}
            </Badge>
        )}
        {row.channel === "" ? null : <Badge tone="neutral">{words.channel(row.channel)}</Badge>}
    </Stack>
)

/** The row of the Grammar list for one conversation: avatar, name, last words, and the time and chips at the end. */
const itemOf = (row: ThreadListRow, words: RowWords): ListBoxItem => ({
    id: row.id,
    label: row.name,
    leading: <Avatar name={row.name} isDecorative />,
    ...(row.preview === "" ? {} : { description: row.preview }),
    trailing: trailingOf(row, words),
})

/** The tabs of the inbox with their counts; a counts read that failed or is empty leaves the tabs without them. */
const InboxTabs = (props: InboxListProps): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const specs: ReadonlyArray<TabSpec> = INBOX_TABS.map((value) => ({
        value,
        label: words({ key: `inbox_tab_${value}` }),
        attention: value === "needs",
    }))
    const counts = parsedSlot(props.slots.counts.slot, countsView)
    const tabs = (view: TabCounts | null): ReactNode => (
        <Tabs
            kind="filter"
            label={words({ key: "status_filter_label" })}
            moreLabel={() => words({ key: "filtersOverflow" })}
            overflowLabel={words({ key: "filtersOverflow" })}
            inset="none"
            selectedKey={tabOf(
                props.params.value(props.props.statusParam),
                props.params.value(props.props.periodParam),
            )}
            items={tabEntriesOf(words({ key: "filter_all" }), specs, view).map((entry) =>
                view !== null && entry.id === "today" && !("today" in view.counts)
                    ? { id: entry.id, label: entry.label }
                    : entry,
            )}
            onSelect={(key) => {
                const chosen = paramsOfTab(key)
                props.params.setMany({
                    [props.props.statusParam]: chosen.status,
                    [props.props.periodParam]: chosen.period,
                })
            }}
        />
    )
    if ("isError" in counts) return tabs(null)
    if ("isEmpty" in counts) return tabs(EMPTY_TAB_COUNTS)
    return (
        <SlotView
            slot={counts}
            labels={labels}
            placeholder={TAB_COUNTS_PLACEHOLDER}
            forbidden="hide"
            render={(view, isLoading) => tabs(isLoading ? null : view)}
        />
    )
}

/** The conversations: a selectable list that writes the chosen one to the select param and loads further pages on request. */
const InboxRows = (props: InboxListProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const searched = queryOf(props.params.value(props.props.searchParam))
    const labels = useSlotLabels({ key: searched === null ? "list_empty" : "list_empty_search" })
    const read = props.slots.threads
    const rowWords = {
        untitled: words({ key: "inbox_untitled" }),
        byPerson: words({ key: "inbox_by_person" }),
        byAi: words({ key: "inbox_by_ai" }),
    }
    const rows = derivedSlot(parsedSlot(read.slot, recordsView), (records) => threadRowsOf(records, rowWords))
    const chipWords: RowWords = {
        locale: host.locale(),
        status: (row) =>
            row.status === "handled" && row.handledBy !== ""
                ? `${row.handledBy}${words({ key: "inbox_status_handled_suffix" })}`
                : words({ key: `row_${row.status ?? "ai"}` }),
        channel: (key) => words({ key: `channel_${key}` }),
    }
    const more = moreStateOf(read.page)
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={[]}
            onRetry={read.retry}
            {...(searched === null
                ? {}
                : {
                      emptyAction: {
                          label: words({ key: "searchClear" }),
                          onAction: () => props.params.set(props.props.searchParam, null),
                      },
                  })}
            render={(items, isLoading) => (
                <Stack gap="row">
                    <ListBox
                        label={words({ key: "list_label" })}
                        items={items.map((row) => itemOf(row, chipWords))}
                        selectionMode="single"
                        selectionIndicator="none"
                        selectedIds={selectionOf(props.params.value(props.props.selectParam))}
                        onSelectionChange={(ids) => {
                            const id = chosenRow(ids)
                            if (id !== null) props.params.set(props.props.selectParam, id)
                        }}
                        isLoading={isLoading}
                    />
                    {read.page === null || more === "none" ? null : (
                        <Cluster gap="inline" align="center">
                            {more === "failed" ? (
                                <Text size="sm" tone="muted">
                                    {words({ key: "listLoadFailed" })}
                                </Text>
                            ) : null}
                            <Button
                                intent="neutral"
                                size="sm"
                                isPending={more === "loading"}
                                onPress={read.page.loadMore}
                            >
                                {words({ key: more === "failed" ? "slotRetry" : "listLoadMore" })}
                            </Button>
                        </Cluster>
                    )}
                </Stack>
            )}
        />
    )
}

/** The list pane of the inbox: the search, the tabs with their counts, and a row per conversation. */
export const InboxList = (props: InboxListProps): ReactNode => {
    const words = useBlockWords()
    return (
        <Stack gap="row">
            <PaneSearch
                param={props.props.searchParam}
                params={props.params}
                label={words({ key: "search_label" })}
                clearLabel={words({ key: "searchClear" })}
            />
            <InboxTabs {...props} />
            <InboxRows {...props} />
        </Stack>
    )
}
