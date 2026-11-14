import { Button, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneHead } from "@/components/composites/PaneHead"
import { TeamChatNewChat } from "@/components/composites/TeamChatNewChat"
import { TeamChatRoomList } from "@/components/frames/TeamChatRoomList"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { TeamChatRoomRow, TeamChatRoomsHandlers, TeamChatRoomsViewProps } from "@/modules/types"

/** Props for the pure half of the list of rooms. */
export interface TeamChatRoomsBaseProps {
    readonly props: TeamChatRoomsViewProps
    readonly on: TeamChatRoomsHandlers
}

/** The skeleton of the room list keeps the geometry of the ready rows. */
const PLACEHOLDER_ROWS: ReadonlyArray<TeamChatRoomRow> = ["a", "b", "c", "d"].map((id) => ({
    id,
    kind: "group",
    title: "",
    isNivo: false,
    mark: { kind: "group", id, name: "", picture: null },
    other: null,
    preview: "",
    when: "",
    unread: 0,
    mentions: 0,
    isSelected: false,
}))

/** The new-chat drawer, drawn inside the list band so the page stays one grid. */
const NewChat = (props: TeamChatRoomsBaseProps) => (
    <TeamChatNewChat
        {...props.props.newChat}
        onOpenChange={props.on.newChatOpenChange}
        onDirect={props.on.newChatDirect}
        onGroupName={props.on.newChatGroupName}
        onGroupMembers={props.on.newChatGroupMembers}
        onStartDirect={props.on.newChatStartDirect}
        onCreateGroup={props.on.newChatCreateGroup}
    />
)

/** The rooms through the slot's one status recipe: skeleton, empty notice with its action, failure band with its retry. */
const RoomsContent = (props: TeamChatRoomsBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={PLACEHOLDER_ROWS}
        labels={props.props.labels}
        errorDescription={props.props.copy.errorBody}
        emptyDescription={props.props.copy.roomsEmpty}
        emptyIconSource={nivoIconSource("chat", "leading")}
        emptyAction={{ label: props.props.copy.roomsEmptyAction, onAction: props.on.openNewChat }}
        onRetry={props.on.refresh}
        render={(rows, isLoading) => (
            <TeamChatRoomList
                rows={rows}
                isLoading={isLoading}
                copy={props.props.copy}
                selectedId={props.props.selectedId}
                query={props.props.query}
                onQuery={props.on.query}
                onSelect={props.on.select}
            />
        )}
    />
)

/** The rooms pane on the surface: its head with the way to start a chat, then the searchable rooms under their kind. */
export const TeamChatRoomsBase = (props: TeamChatRoomsBaseProps) => (
    <>
        <PaneHead
            title={props.props.copy.title}
            actions={
                <Button
                    intent="neutral"
                    size="sm"
                    onPress={props.on.openNewChat}
                >
                    {props.props.copy.newChat}
                </Button>
            }
        />
        <PaneSection scroll={{ label: props.props.copy.listLabel }}>
            <RoomsContent {...props} />
            <NewChat {...props} />
        </PaneSection>
    </>
)
