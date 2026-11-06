import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Avatar, Badge, ListBox, RelativeTime, Stack, SurfaceCard } from "@starci/grammar/common"
import type { BadgeTone, FilterFields, ListBoxItem } from "@starci/grammar/common"
import type { inboxBlock } from "../../blocks/chatbot/inbox.block"
import { countsView, tabEntriesOf } from "../../rows/filter-tabs"
import type { TabSpec } from "../../rows/filter-tabs"
import { footersOf, tabCountsOf } from "../../rows/list-card"
import { paneHeadersOf } from "../../rows/pane-headers"
import { tabOf, paramsOfTab } from "../../rows/chatbot/inbox-tabs"
import { INBOX_TABS, threadRowsOf } from "../../rows/chatbot/thread-rows"
import type { ThreadListRow, ThreadStatus } from "../../rows/chatbot/thread-rows"
import { chosenRow, moreStateOf, recordsView, selectionOf } from "../../rows/rows"
import { queryOf } from "../../rows/search"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { usePaneSearch } from "../composites/usePaneSearch"
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
    leading: <Avatar name={row.name} {...(row.avatar === "" ? {} : { src: row.avatar })} isDecorative />,
    ...(row.preview === "" ? {} : { description: row.preview }),
    trailing: trailingOf(row, words),
})

/** The tabs of the inbox as the filter zone of its card, with their counts; a counts read that failed or is loading leaves the tabs without them. */
const filterOf = (props: InboxListProps, words: ReturnType<typeof useBlockWords>): FilterFields => {
    const specs: ReadonlyArray<TabSpec> = INBOX_TABS.map((value) => ({
        value,
        label: words({ key: `inbox_tab_${value}` }),
        attention: value === "needs",
    }))
    const view = tabCountsOf(parsedSlot(props.slots.counts.slot, countsView))
    return {
        label: words({ key: "status_filter_label" }),
        moreLabel: () => words({ key: "filtersOverflow" }),
        overflowLabel: words({ key: "filtersOverflow" }),
        selectedKey: tabOf(props.params.value(props.props.statusParam), props.params.value(props.props.periodParam)),
        items: tabEntriesOf(words({ key: "filter_all" }), specs, view).map((entry) =>
            view !== null && entry.id === "today" && !("today" in view.counts)
                ? { id: entry.id, label: entry.label }
                : entry,
        ),
        onSelect: (key) => {
            const chosen = paramsOfTab(key)
            props.params.setMany({
                [props.props.statusParam]: chosen.status,
                [props.props.periodParam]: chosen.period,
            })
        },
    }
}

/** The list pane of the inbox: one surface card whose header holds the tabs with their counts and the search on one line, and whose body is a row per conversation. */
export const InboxList = (props: InboxListProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const searched = queryOf(props.params.value(props.props.searchParam))
    const labels = useSlotLabels({ key: searched === null ? "list_empty" : "list_empty_search" })
    const search = usePaneSearch(props.params, props.props.searchParam, {
        label: words({ key: "search_label" }),
        clearLabel: words({ key: "searchClear" }),
    })
    const headers = paneHeadersOf(filterOf(props, words), search)
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
    const label = words({ key: "list_label" })
    return (
        <SlotView
            slot={rows}
            labels={labels}
            placeholder={[]}
            onRetry={read.retry}
            frame={(notice: ReactNode) => (
                <SurfaceCard ariaLabel={label} headers={headers}>
                    {notice}
                </SurfaceCard>
            )}
            {...(searched === null
                ? {}
                : {
                      emptyAction: {
                          label: words({ key: "searchClear" }),
                          onAction: () => props.params.set(props.props.searchParam, null),
                      },
                  })}
            render={(items, isLoading) => (
                <SurfaceCard
                    ariaLabel={label}
                    headers={headers}
                    footers={
                        read.page === null
                            ? []
                            : footersOf(
                                  moreStateOf(read.page),
                                  { loadMore: words({ key: "listLoadMore" }), retry: labels.retry },
                                  read.page.loadMore,
                              )
                    }
                    isLoading={isLoading}
                >
                    <ListBox
                        label={label}
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
                </SurfaceCard>
            )}
        />
    )
}
