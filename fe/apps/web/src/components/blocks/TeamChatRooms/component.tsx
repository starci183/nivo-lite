import { Button, IconButton } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneHead } from "@/components/composites/PaneHead"
import { TeamChatNewChat } from "@/components/composites/TeamChatNewChat"
import { PaneBody } from "@/components/frames/PaneBody"
import { TeamChatRoomList } from "@/components/frames/TeamChatRoomList"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { TeamChatRoomRow } from "@/modules/types"
import type { TeamChatRoomsBaseProps } from "./types"

/** The skeleton of the room list keeps the geometry of the ready rows. */
const PLACEHOLDER_ROWS: ReadonlyArray<TeamChatRoomRow> = ["a", "b", "c", "d"].map((id) => ({
    id,
    kind: "group",
    title: "",
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
                onSelect={props.on.select}
            />
        )}
    />
)

/** Presentational list of the rooms of the viewer, to stand in a pane: its head with the way to start a chat, and the rooms. */
export const TeamChatRoomsBase = (props: TeamChatRoomsBaseProps) => (
    <>
        <PaneHead
            title={props.props.copy.title}
            actions={
                <>
                    <Button intent="neutral" onPress={props.on.openNewChat}>
                        {props.props.copy.newChat}
                    </Button>
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("retry", "leading")}
                        label={props.props.copy.refresh}
                        onPress={props.on.refresh}
                    />
                </>
            }
        />
        <PaneBody overlay={<NewChat {...props} />}>
            <RoomsContent {...props} />
        </PaneBody>
    </>
)
