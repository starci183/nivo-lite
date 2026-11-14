import { NIVO_MARK, partyKeyOf } from "@/modules/teamChat"
import type { TeamChatHeadView, TeamChatPanelsView } from "@/modules/types"
import { partyOf } from "./teamChat.shared"
import type { RoomViewContext, Words } from "./teamChat.view"
import type { TeamChatRoomState } from "./useTeamChatRoomState"

/** The head line of a group: how many it holds, then the agents among them. */
const groupLineOf = (t: Words, room: NonNullable<TeamChatRoomState["rooms"]["room"]>): string => {
    const agents = room.members.filter((member) => member.memberKind === "agent").map((member) => member.name)
    const people = t("peopleCount", { count: room.members.length })
    return agents.length === 0 ? people : `${people} · ${agents.join(", ")}`
}

/** Who the open room is with, for the head: the room, else the agent a first message will open it with; none on the chat page with no room. */
export const headOf = (context: RoomViewContext): TeamChatHeadView | null => {
    const { room, t, agent } = context
    const open = room.rooms.room
    if (open === undefined) {
        if (agent === null) return null
        return {
            title: agent.name,
            subtitle: t("kindAgent"),
            mark: { kind: "agent", id: agent.id, name: agent.name, picture: agent.picture },
        }
    }
    if (open.withNivo) {
        return {
            title: open.name,
            subtitle: t("nivoRoom.subtitle"),
            mark: NIVO_MARK,
        }
    }
    const other = room.rooms.other
    if (other === null) {
        return {
            title: open.name,
            subtitle: groupLineOf(t, open),
            mark: { kind: "group", id: open.id, name: open.name, picture: null },
        }
    }
    return {
        title: open.name,
        subtitle: other.kind === "agent" ? t("kindAgent") : t("kindPerson"),
        mark: { kind: other.kind, id: other.id, name: open.name, picture: other.picture ?? null },
    }
}

/** The panels the head opens: the pinned messages and the members of the open room. */
export const panelsOf = (context: RoomViewContext): TeamChatPanelsView => {
    const { room, t } = context
    return {
        open: room.panel,
        pinned: room.pinned.slot,
        members: (room.rooms.room?.members ?? []).map((member) => {
            const party = partyOf(member.memberKind, member.memberId, member.name, context.words)
            return {
                key: partyKeyOf(party),
                party,
                mark: { kind: party.kind, id: party.id, name: party.name, picture: party.picture ?? null },
                description: party.kind === "agent" ? t("kindAgent") : t("kindPerson"),
            }
        }),
    }
}
