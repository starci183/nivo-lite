import { EmptyNotice, ListBox, Stack } from "@starci/grammar/common"
import type { ListBoxItem, ListBoxSection } from "@starci/grammar/common"
import { FilterGroup } from "@/components/composites/FilterGroup"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { TeamChatMarkView, TeamChatRoomRow, TeamChatRoomsCopy } from "@/modules/types"

/** What the room list draws and what it asks of its owner. */
interface TeamChatRoomListProps {
    readonly rows: ReadonlyArray<TeamChatRoomRow>
    readonly isLoading: boolean
    readonly copy: TeamChatRoomsCopy
    readonly selectedId: string | null
    readonly query: string
    readonly onQuery: (value: string) => void
    readonly onSelect: (roomId: string) => void
}

/** The mark of a room: the person or the agent it is with, else the group glyph. */
const markOf = (room: TeamChatRoomRow): TeamChatMarkView =>
    room.other === null
        ? { kind: "group", id: room.id, name: room.title, picture: null }
        : { kind: room.other.kind, id: room.other.id, name: room.title, picture: room.other.picture ?? null }

/** The unread count at the end of a row: danger when it holds a mention of the viewer. */
const unreadBadgeOf = (row: TeamChatRoomRow) =>
    row.unread === 0
        ? {}
        : { badge: { label: String(row.unread), tone: row.mentions > 0 ? ("danger" as const) : ("accent" as const) } }

/** One row: the mark, the name, the last line in one ellipsized line, and at the end the time over the unread count. */
const itemOf = (row: TeamChatRoomRow, groupLine: string): ListBoxItem => ({
    id: row.id,
    label: row.title,
    description: row.kind === "group" && row.preview === "" ? groupLine : row.preview,
    descriptionLines: 1 as const,
    leading: <ChatPartyMark mark={markOf(row)} />,
    trailing: <RowTrailing meta={row.when} {...unreadBadgeOf(row)} />,
})

/** The rows whose name or last line holds what the search field holds. */
const matchingOf = (rows: ReadonlyArray<TeamChatRoomRow>, query: string): ReadonlyArray<TeamChatRoomRow> => {
    const needle = query.trim().toLocaleLowerCase()
    return needle === "" ? rows : rows.filter((row) => `${row.title} ${row.preview}`.toLocaleLowerCase().includes(needle))
}

/** The rooms under the muted labels of their kind: groups, agents, people; a kind with no room draws no label. */
const sectionsOf = (rows: ReadonlyArray<TeamChatRoomRow>, copy: TeamChatRoomsCopy): ReadonlyArray<ListBoxSection> =>
    [
        { id: "group", label: copy.sectionGroup, rooms: rows.filter((row) => row.kind === "group") },
        { id: "agent", label: copy.sectionAgent, rooms: rows.filter((row) => row.other?.kind === "agent") },
        { id: "person", label: copy.sectionPerson, rooms: rows.filter((row) => row.other?.kind === "user") },
    ]
        .filter((section) => section.rooms.length > 0)
        .map((section) => ({
            id: section.id,
            label: section.label,
            items: section.rooms.map((row) => itemOf(row, copy.groupLine)),
        }))

/** The rooms of the viewer: a search field, then the rooms grouped as groups, agents and people, the open one drawn as a fill. */
export const TeamChatRoomList = (props: TeamChatRoomListProps) => (
    <Stack gap="row">
        <FilterGroup
            isLoading={props.isLoading}
            search={{
                label: props.copy.searchLabel,
                placeholder: props.copy.searchPlaceholder,
                clearLabel: props.copy.searchClear,
                value: props.query,
                onChange: props.onQuery,
            }}
        />
        <ListBox
            label={props.copy.listLabel}
            sections={sectionsOf(matchingOf(props.rows, props.query), props.copy)}
            isLoading={props.isLoading}
            emptyContent={
                <EmptyNotice message={props.copy.searchEmpty} iconSource={nivoIconSource("search", "leading")} />
            }
            selectionMode="single"
            selectionIndicator="none"
            selectedIds={props.selectedId === null ? [] : [props.selectedId]}
            onSelectionChange={(ids) => {
                // Pressing the open row clears the selection: it is the row's own press, so it opens that row again (a phone shows its pane).
                const id = ids[0] ?? props.selectedId
                if (id !== null) props.onSelect(id)
            }}
            onAction={props.onSelect}
        />
    </Stack>
)
