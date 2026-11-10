"use client"

import type { PageHeaderBreadcrumbs } from "@starci/grammar/common"
import { TeamChatRooms } from "@/components/blocks/TeamChatRooms"
import { useInstallations } from "@/hooks/installations"
import { roomHandlersOf, useTeamChatRoomState, useTeamChatRoomView } from "@/hooks/teamChat"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { TeamChatPanesBase, teamChatRoomPartsOf } from "./component"

/** The agent tab has no way back to the list. */
const NO_BACK = (): void => undefined

/** The words of the chat page and the room its address names, or none yet. */
interface TeamChatPanesProps {
    readonly roomId: string | null
    readonly breadcrumbs: PageHeaderBreadcrumbs
    readonly gridLabel: string
    readonly listLabel: string
    readonly roomLabel: string
}

/**
 * The chat page: the trail, the rooms of the viewer in one pane and the one chat room of the app in the other. The room pane holds the head
 * and the thread as its body and the composer as its fixed footer, so only the thread scrolls.
 */
export const TeamChatPanes = (props: TeamChatPanesProps) => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const room = useTeamChatRoomState({ roomId: props.roomId, withAgentId: null })
    const back = (): void => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.chat))
    const view = useTeamChatRoomView(room, { agent: null, canGoBack: true })
    return (
        <TeamChatPanesBase
            props={{
                breadcrumbs: props.breadcrumbs,
                gridLabel: props.gridLabel,
                listLabel: props.listLabel,
                roomLabel: props.roomLabel,
                hasRoom: props.roomId !== null,
                list: <TeamChatRooms />,
                parts: teamChatRoomPartsOf({ props: view, on: roomHandlersOf(room, back) }),
            }}
        />
    )
}

/** The words of the room pane of an agent page, and the instance it names. */
interface AgentTeamChatPanesProps {
    readonly installationId: string
    readonly gridLabel: string
    readonly roomLabel: string
}

/** The same room as the chat page, opened on the direct room with the agent that drives an instance; the room itself opens on the first message, never on a read. */
export const AgentTeamChatPanes = (props: AgentTeamChatPanesProps) => {
    const { installations } = useInstallations()
    const installation = installations?.find((entry) => entry.id === props.installationId)
    const agentId = installation?.agentId ?? null
    const room = useTeamChatRoomState({ roomId: null, withAgentId: agentId })
    const view = useTeamChatRoomView(room, {
        agent: { id: agentId ?? "", name: installation?.name ?? "", picture: installation?.agentAvatarUrl ?? null },
        canGoBack: false,
    })
    return (
        <TeamChatPanesBase
            props={{
                breadcrumbs: null,
                gridLabel: props.gridLabel,
                listLabel: "",
                roomLabel: props.roomLabel,
                hasRoom: true,
                list: null,
                parts: teamChatRoomPartsOf({ props: view, on: roomHandlersOf(room, NO_BACK) }),
            }}
        />
    )
}
