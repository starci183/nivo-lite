"use client"

import { useSearchParams } from "next/navigation"
import { useTeamChatListState, useTeamChatRoomsView } from "@/hooks/teamChat"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { chatRoomHref, workspaceHref } from "@/modules/routes"
import { TeamChatRoomsBase } from "./component"

/** The rooms of the viewer: the one the address names (`room`) marked; choosing one writes it into the address, and the room opens beside. */
export const TeamChatRooms = () => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const selectedId = useSearchParams().get("room")
    const openRoom = (roomId: string): void => router.push(workspaceHref(workspaceId, chatRoomHref(roomId)))
    const list = useTeamChatListState(selectedId, openRoom)
    const { newChat } = list
    const view = useTeamChatRoomsView(list, selectedId)
    return (
        <TeamChatRoomsBase
            props={view}
            on={{
                refresh: list.rooms.refresh,
                select: openRoom,
                openNewChat: newChat.open,
                newChatOpenChange: newChat.setOpen,
                newChatDirect: newChat.setDirect,
                newChatGroupName: newChat.setGroupName,
                newChatGroupMembers: newChat.setGroupMembers,
                newChatStartDirect: newChat.startDirect,
                newChatCreateGroup: newChat.createGroup,
            }}
        />
    )
}
