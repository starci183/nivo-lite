"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { useTeamChatListState } from "@/hooks/teamChat"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { chatRoomHref, workspaceHref } from "@/modules/routes"
import { TeamChatRoomsBase } from "./component"
import { roomsViewPropsOf } from "./view"

/** The rooms of the viewer: the one the address names (`room`) marked; choosing one writes it into the address, and the room opens beside. */
export const TeamChatRooms = () => {
    const t = useTranslations("teamChat")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const selectedId = useSearchParams().get("room")
    const openRoom = (roomId: string): void => router.push(workspaceHref(workspaceId, chatRoomHref(roomId)))
    const list = useTeamChatListState(selectedId, openRoom)
    const { newChat } = list
    return (
        <TeamChatRoomsBase
            props={roomsViewPropsOf({
                list,
                t,
                refreshLabel: pane.refresh,
                labels: { ...slotLabels(t("roomsEmpty")), error: t("errorTitle") },
                selectedId,
            })}
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
