import type { PageHeaderBreadcrumbs } from "@starci/grammar/common"
import { TeamChatRoom } from "@/components/blocks/TeamChatRoom"
import { TeamChatRooms } from "@/components/blocks/TeamChatRooms"

/** The words and the open room of the chat page. */
export interface TeamChatPageBaseProps {
    readonly props: {
        /** The trail: the dashboard, then the chat. */
        readonly breadcrumbs: PageHeaderBreadcrumbs
        readonly gridLabel: string
        readonly listLabel: string
        readonly roomLabel: string
        /** The room the address names, or null. */
        readonly room: string | null
    }
}

/** Draws the chat page: the trail, the rooms of the viewer in one pane and the one chat room of the app in the other. */
export const TeamChatPageBase = (props: TeamChatPageBaseProps) => (
    <TeamChatRoom
        list={<TeamChatRooms />}
        roomId={props.props.room}
        breadcrumbs={props.props.breadcrumbs}
        gridLabel={props.props.gridLabel}
        listLabel={props.props.listLabel}
        roomLabel={props.props.roomLabel}
    />
)
