import {
    Avatar,
    Divider,
    EmptyNotice,
    Heading,
    HorizontalScrollRegion,
    ListBox,
    SearchField,
    SegmentedControl,
    Text,
} from "@starci/grammar/common"
import { ChatbotChips } from "@/components/branches/ChatbotChips"
import {
    CENTER_CLASS_NAME,
    FILTERS_CLASS_NAME,
    HEAD_CLASS_NAME,
    LIST_BODY_CLASS_NAME,
    SEARCH_CLASS_NAME,
} from "./classNames"

/** One state mark of a conversation. */
interface ChatbotListChip {
    readonly id: string
    readonly label: string
    readonly tone: "warning" | "accent" | "neutral"
    readonly isDot: boolean
}

/** One conversation row, as plain words. */
interface ChatbotListItem {
    readonly id: string
    readonly name: string
    readonly preview: string
    readonly time: string
    readonly channel: string
    readonly chips: ReadonlyArray<ChatbotListChip>
}

/** The conversation pane: its words, its filters, the query and the rows. */
export interface ChatbotConversationListProps {
    readonly title: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly listLabel: string
    readonly query: string
    readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly selectedFilter: string
    readonly items: ReadonlyArray<ChatbotListItem>
    readonly hasConversations: boolean
    readonly emptyListTitle: string
    readonly emptyListBody: string
    readonly emptyFilter: string
    readonly selectedId: string | null
    readonly onQuery: (query: string) => void
    readonly onFilter: (filter: string) => void
    readonly onSelect: (id: string) => void
}

/** The left pane of the inbox: search, filters and the conversation rows. */
export const ChatbotConversationList = (props: ChatbotConversationListProps) => (
    <>
        <div className={HEAD_CLASS_NAME}>
            <Heading level={2}>{props.title}</Heading>
        </div>
        <Divider semantics="presentation" />
        <div className={SEARCH_CLASS_NAME}>
            <SearchField
                label={props.searchLabel}
                isLabelHidden
                placeholder={props.searchPlaceholder}
                clearLabel={props.clearLabel}
                value={props.query}
                onValueChange={props.onQuery}
                onClear={() => props.onQuery("")}
            />
        </div>
        <div className={FILTERS_CLASS_NAME}>
            <HorizontalScrollRegion overflow="needed" isFocusable={false}>
                <SegmentedControl
                    label={props.listLabel}
                    isLabelHidden
                    options={props.filters}
                    value={props.selectedFilter}
                    onValueChange={props.onFilter}
                />
            </HorizontalScrollRegion>
        </div>
        {props.items.length === 0 ? (
            <div className={CENTER_CLASS_NAME}>
                {props.hasConversations ? (
                    <EmptyNotice message={props.emptyFilter} />
                ) : (
                    <EmptyNotice message={props.emptyListTitle} description={props.emptyListBody} />
                )}
            </div>
        ) : (
            <div className={LIST_BODY_CLASS_NAME}>
                <ListBox
                    label={props.listLabel}
                    selectionMode="single"
                    selectedIds={props.selectedId === null ? [] : [props.selectedId]}
                    onSelectionChange={(ids) => {
                        const id = ids[0] ?? props.selectedId
                        if (id !== null) props.onSelect(id)
                    }}
                    items={props.items.map((item) => ({
                        id: item.id,
                        label: item.name,
                        leading: <Avatar name={item.name} size="md" isDecorative />,
                        trailing: (
                            <Text size="xs" tone="muted">
                                {item.time}
                            </Text>
                        ),
                        description: (
                            <>
                                <Text size="sm" tone="muted" overflow="truncate">
                                    {item.preview}
                                </Text>
                                <ChatbotChips channel={item.channel} chips={item.chips} />
                            </>
                        ),
                    }))}
                />
            </div>
        )}
    </>
)
