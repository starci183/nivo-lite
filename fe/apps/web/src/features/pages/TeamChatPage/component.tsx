import { Page, Pane, PaneGrid } from "@starci/grammar/common"
import { TeamChatRoom } from "@/components/blocks/TeamChatRoom"
import { TeamChatRooms } from "@/components/blocks/TeamChatRooms"

/** The words and the open room of the chat page. */
export interface TeamChatPageBaseProps {
    readonly props: {
        readonly gridLabel: string
        readonly listLabel: string
        readonly roomLabel: string
        /** The room the address names, or null. */
        readonly room: string | null
    }
}

/** The areas of the page: a phone shows the rooms or the open room alone; from 48rem the list stands beside the room. */
const gridOf = (hasRoom: boolean) =>
    ({
        areas: { base: [hasRoom ? "room" : "list"], medium: ["list room"] },
        columns: { base: ["fill"], medium: ["wide", "fill"] },
        rows: { base: ["fill"], medium: ["fill"] },
    }) as const

/** Draws the chat page: the list of rooms in one pane and the room block in the other. */
export const TeamChatPageBase = (props: TeamChatPageBaseProps) => {
    const view = props.props
    const grid = gridOf(view.room !== null)
    return (
        <Page chrome="panes">
            <PaneGrid label={view.gridLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                <Pane area="list" surface scroll label={view.listLabel}>
                    <TeamChatRooms />
                </Pane>
                <Pane area="room" surface label={view.roomLabel}>
                    <TeamChatRoom roomId={view.room} />
                </Pane>
            </PaneGrid>
        </Page>
    )
}
