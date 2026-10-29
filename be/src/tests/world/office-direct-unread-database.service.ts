import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { AgentEntity } from "@modules/domain/agents"
import { leadsEntities } from "@modules/domain/leads"
import { messagesEntities } from "@modules/domain/messages"
import { officeRoomsEntities } from "@modules/domain/office-rooms"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import { WorkspaceEntity } from "@modules/domain/workspaces"

const [LeadEntity] = leadsEntities
const [MessageEntity] = messagesEntities
const [, , , OfficeRoomReadEntity] = officeRoomsEntities

/** How many read markers one conversation key holds. */
export interface ReadMarkerCountRow {
    /** The number of marker rows. */
    readonly n: number
}

/** Removes the story's footprints under both workspaces, in the order the foreign keys allow. */
export const removeDirectUnreadStory = async (
    manager: EntityManager,
    workspaceIds: ReadonlyArray<string>,
    agentIds: ReadonlyArray<string>,
    leadIds: ReadonlyArray<string>,
): Promise<void> => {
    await manager.delete(MessageEntity, { workspaceId: In([...workspaceIds]) })
    await manager.delete(AgentMessageEntity, { workspaceId: In([...workspaceIds]) })
    await manager.delete(AgentConversationEntity, { workspaceId: In([...workspaceIds]) })
    await manager.delete(OfficeRoomReadEntity, { workspaceId: In([...workspaceIds]) })
    await manager.delete(AgentEntity, { id: In([...agentIds]) })
    await manager.delete(LeadEntity, { id: In([...leadIds]) })
    // Cascade clears the seated owners; the last-owner guard only bars lone deletes.
    await manager.delete(WorkspaceEntity, { id: In([...workspaceIds]) })
    await manager.delete(WorkspaceMemberEntity, { workspaceId: In([...workspaceIds]) })
}

/** Counts the marker rows a conversation read writes under one marker key. */
export const markersOf = async (
    manager: EntityManager,
    workspaceId: string,
    room: string,
): Promise<Array<ReadMarkerCountRow>> => [
    { n: await manager.count(OfficeRoomReadEntity, { where: { workspaceId, room } }) },
]
