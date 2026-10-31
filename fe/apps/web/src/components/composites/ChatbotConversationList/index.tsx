import {
    Avatar,
    EmptyNotice,
    Heading,
    HorizontalScrollRegion,
    ListBox,
    PaneSection,
    SearchField,
    SegmentedControl,
    Text,
} from "@starci/grammar/common"
import { ChatbotChips } from "@/components/branches/ChatbotChips"

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
    /** The conversations are not read yet: the pane draws skeleton rows. */
    readonly isSkeleton?: boolean
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
                <SegmentedControl
                    label={props.listLabel}
                    isLabelHidden
                    options={props.filters}
                    value={props.selectedFilter}
                    onValueChange={props.onFilter}
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
                            <Avatar name={item.name} size="md" isDecorative isSkeleton={props.isSkeleton === true} />
                        ),
                        trailing: (
                            <Text size="xs" tone="muted" isSkeleton={props.isSkeleton === true}>
                                {item.time}
                            </Text>
                        ),
                        description: (
                            <>
                                <Text size="sm" tone="muted" overflow="truncate" isSkeleton={props.isSkeleton === true}>
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
