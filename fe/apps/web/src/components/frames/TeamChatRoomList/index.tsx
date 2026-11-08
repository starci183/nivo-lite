import { EmptyNotice, IconTile, ListBox, type ListBoxItem } from "@starci/grammar/common"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { TeamChatRoomRow } from "@/modules/types"

/** The words of the room list. */
interface TeamChatRoomListCopy {
    readonly listLabel: string
    readonly groupLine: string
    readonly roomsEmpty: string
}

/** What the room list draws and what it asks of its owner. */
interface TeamChatRoomListProps {
    readonly rows: ReadonlyArray<TeamChatRoomRow>
    readonly isLoading: boolean
    readonly copy: TeamChatRoomListCopy
    readonly selectedId: string | null
    readonly onSelect: (roomId: string) => void
}

/** The mark of a room: the agent's, the person's, or the group's chat glyph. */
const markOf = (room: TeamChatRoomRow) => {
    if (room.other === null) return <IconTile source={nivoIconSource("chat", "leading")} tone="neutral" />
    return room.other.kind === "agent" ? (
        <AgentMark label={room.title} seed={room.other.id} size="md" />
    ) : (
        <PersonAvatar name={room.title} seed={room.other.id} size="md" />
    )
}

/** The unread count at the end of a row: danger when it holds a mention of the viewer. */
const unreadBadgeOf = (row: TeamChatRoomRow) =>
    row.unread === 0
        ? {}
        : { badge: { label: String(row.unread), tone: row.mentions > 0 ? ("danger" as const) : ("accent" as const) } }

/** The list rows: the name, the last line, and at the end the time over the unread count. */
const itemsOf = (rows: ReadonlyArray<TeamChatRoomRow>, groupLine: string): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.title,
        description: row.kind === "group" && row.preview === "" ? groupLine : row.preview,
        descriptionLines: 1 as const,
        leading: markOf(row),
        trailing: <RowTrailing meta={row.when} {...unreadBadgeOf(row)} />,
    }))

/** The rooms of the viewer as a list: the name, the last line, the time and the unread count. */
export const TeamChatRoomList = (props: TeamChatRoomListProps) => (
    <ListBox
        items={itemsOf(props.rows, props.copy.groupLine)}
        label={props.copy.listLabel}
        isLoading={props.isLoading}
        emptyContent={<EmptyNotice message={props.copy.roomsEmpty} />}
        selectionMode="single"
        selectedIds={props.selectedId === null ? [] : [props.selectedId]}
        selectionIndicator="none"
        onSelectionChange={(ids) => {
            // Pressing the open row clears the selection: it is the row's own press, so it opens that row again (a phone shows its pane).
            const id = ids[0] ?? props.selectedId
            if (id !== null) props.onSelect(id)
        }}
        onAction={props.onSelect}
    />
)
