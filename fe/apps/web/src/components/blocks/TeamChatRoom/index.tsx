"use client"

import { useTranslations } from "next-intl"
import { useInstanceAgentId } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { useTeamChatRoomState } from "@/hooks/teamChat"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { TeamChatRoomBase } from "./component"
import { roomHandlersOf } from "./handlers"
import { roomViewPropsOf } from "./view"

/** The props of the room of the chat page: the room the address names, or none yet. */
interface TeamChatRoomProps {
    readonly roomId: string | null
}

/** The room the chat page opened: its head with the way back to the list, its thread with the cards, and its composer. */
export const TeamChatRoom = (props: TeamChatRoomProps) => {
    const t = useTranslations("teamChat")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const room = useTeamChatRoomState({ roomId: props.roomId, withAgentId: null })
    return (
        <TeamChatRoomBase
            props={roomViewPropsOf({
                room,
                t,
                backLabel: pane.backToList,
                labels: { ...slotLabels(t("roomsEmpty")), error: t("errorTitle") },
                withAgent: false,
                canGoBack: true,
            })}
            on={roomHandlersOf(room, () => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.chat)))}
        />
    )
}

/** The props of the room of an agent page: the instance the page names. */
interface AgentTeamChatRoomProps {
    readonly module: ModuleKey
    readonly installationId: string
}

/** The viewer's direct room with the agent that drives an instance: opened on the first message, never on a read. */
export const AgentTeamChatRoom = (props: AgentTeamChatRoomProps) => {
    const t = useTranslations("teamChat")
    const pane = usePaneCopy()
    const slotLabels = useSlotLabels()
    const agentId = useInstanceAgentId(props.module, props.installationId)
    const room = useTeamChatRoomState({ roomId: null, withAgentId: agentId })
    return (
        <TeamChatRoomBase
            props={roomViewPropsOf({
                room,
                t,
                backLabel: pane.backToList,
                labels: { ...slotLabels(t("roomsEmpty")), error: t("errorTitle") },
                withAgent: true,
                canGoBack: false,
            })}
            on={roomHandlersOf(room, () => undefined)}
        />
    )
}
