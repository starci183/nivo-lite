import type { ChatbotListItem, ChatbotConversationListView } from "@/modules/types"
import {
    Avatar,
    EmptyNotice,
    Heading,
    HorizontalScrollRegion,
    ListBox,
    PaneSection,
    SearchField,
    Tabs,
    Text,
} from "@starci/grammar/common"
import { ChatbotChips } from "@/components/branches/ChatbotChips"
/** The conversation pane: its words, its filters, the query and the rows. */
interface ChatbotConversationListProps extends ChatbotConversationListView {
    readonly onQuery: (query: string) => void
    readonly onFilter: (filter: string) => void
    readonly onSelect: (id: string) => void
}
/** Three rows of a conversation with no words: the skeleton draws the same boxes as a loaded row. */
const SKELETON_ITEMS: ReadonlyArray<ChatbotListItem> = ["a", "b", "c"].map((id) => ({
    id,
    name: "x".repeat(16),
    preview: "x".repeat(32),
    time: "x".repeat(5),
    channel: "",
    chips: [],
}))
/** The left pane of the inbox: search, filters and the conversation rows. */
export const ChatbotConversationList = (props: ChatbotConversationListProps) => (
    <>
        <PaneSection align="center">
            <Heading level={2}>{props.title}</Heading>
        </PaneSection>
        <PaneSection>
            <SearchField
                label={props.searchLabel}
                isLabelHidden
                placeholder={props.searchPlaceholder}
                clearLabel={props.clearLabel}
                value={props.query}
                onValueChange={props.onQuery}
                onClear={() => props.onQuery("")}
            />
        </PaneSection>
        <PaneSection bleed="inline">
            <HorizontalScrollRegion overflow="needed" isFocusable={false}>
                <Tabs
                    kind="filter"
                    label={props.listLabel}
                    items={props.filters.map((filter) => ({ id: filter.value, label: filter.label }))}
                    selectedKey={props.selectedFilter}
                    onSelect={props.onFilter}
                />
            </HorizontalScrollRegion>
        </PaneSection>
        {props.items.length === 0 && props.isSkeleton !== true ? (
            <PaneSection align="center" grow>
                {props.hasConversations ? (
                    <EmptyNotice message={props.emptyFilter} />
                ) : (
                    <EmptyNotice message={props.emptyListTitle} description={props.emptyListBody} />
                )}
            </PaneSection>
        ) : (
            <PaneSection scroll={{ label: props.title }}>
                <ListBox
                    label={props.listLabel}
                    selectionMode="single"
                    selectionIndicator="none"
                    selectedIds={props.selectedId === null ? [] : [props.selectedId]}
                    onSelectionChange={(ids) => {
                        const id = ids[0] ?? props.selectedId
                        if (id !== null) props.onSelect(id)
                    }}
                    items={(props.isSkeleton === true ? SKELETON_ITEMS : props.items).map((item) => ({
                        id: item.id,
                        label: item.name,
                        leading: (
                            <Avatar name={item.name} size="md" isDecorative isLoading={props.isSkeleton === true} />
                        ),
                        trailing: (
                            <Text size="xs" tone="muted" isLoading={props.isSkeleton === true}>
                                {item.time}
                            </Text>
                        ),
                        description: (
                            <>
                                <Text size="sm" tone="muted" overflow="truncate" isLoading={props.isSkeleton === true}>
                                    {item.preview}
                                </Text>
                                {props.isSkeleton === true ? null : (
                                    <ChatbotChips channel={item.channel} chips={item.chips} />
                                )}
                            </>
                        ),
                    }))}
                />
            </PaneSection>
        )}
    </>
)
