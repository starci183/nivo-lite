"use client"

import { useInstanceAgentId } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { roomHandlersOf, useTeamChatRoomState, useTeamChatRoomView } from "@/hooks/teamChat"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { TeamChatRoomBase } from "./component"

/** The agent tab has no way back to the list. */
const NO_BACK = (): void => undefined

/** The props of the room of the chat page: the room the address names, or none yet. */
interface TeamChatRoomProps {
    readonly roomId: string | null
}

/** The room the chat page opened: its head with the way back to the list, its thread with the cards, and its composer. */
export const TeamChatRoom = (props: TeamChatRoomProps) => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const room = useTeamChatRoomState({ roomId: props.roomId, withAgentId: null })
    const back = (): void => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.chat))
    const view = useTeamChatRoomView(room, { withAgent: false, canGoBack: true })
    const handlers = roomHandlersOf(room, back)
    return <TeamChatRoomBase props={view} on={handlers} />
}

/** The props of the room of an agent page: the instance the page names. */
interface AgentTeamChatRoomProps {
    readonly module: ModuleKey
    readonly installationId: string
}

/** The viewer's direct room with the agent that drives an instance: opened on the first message, never on a read. */
export const AgentTeamChatRoom = (props: AgentTeamChatRoomProps) => {
    const agentId = useInstanceAgentId(props.module, props.installationId)
    const room = useTeamChatRoomState({ roomId: null, withAgentId: agentId })
    const view = useTeamChatRoomView(room, { withAgent: true, canGoBack: false })
    const handlers = roomHandlersOf(room, NO_BACK)
    return <TeamChatRoomBase props={view} on={handlers} />
}
