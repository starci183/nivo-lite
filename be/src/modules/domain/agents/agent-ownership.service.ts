import { Injectable } from "@nestjs/common"
import type { EntityManager, UpdateResult } from "typeorm"
import {
    WorkspaceMemberDirectoryService,
    WorkspaceMemberSeatsService,
    WorkspaceMembersService,
} from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { isAssignableRole, mayAssign, mayManage, ownerCardOf, resolveOwners, rolesOf } from "./agent-ownership.policy"
import type { AgentOwners, AgentOwnership, OwnershipChange } from "./agents.contracts"
import { InjectAgentRooms } from "./agents.decorators"
import type { AgentRooms } from "./agents.port"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import type { AssignContext, MemberState } from "./agents-reads.contracts"
import { AgentEntity } from "./persistence/entities"

/** The room keys and cards ownership reads are bounded by what one agent can name. */
const MEMBER_LIMIT = 10
const ROOM_LIMIT = 10
const MEMBER_ROOMS_LIMIT = 50

/** The one row `public.workspace_owner_member` answers: its result is named after the function. */
interface WorkspaceOwnerRow {
    readonly workspace_owner_member: string | null
}

/** One department room as the page names it. */
interface RoomLabel {
    readonly key: string
    readonly name: string
}

/** A seat's department room: the room keys a member sits in, in the order the first one is chosen. */
interface SeatRoomRow {
    readonly userId: string
    readonly key: string
}

const GOVERNORS = ["owner", "manager"] as const

@Injectable()
/**
 * Who answers for each agent and who may hand it work: the ownership settings of the agents table. `AgentsService` offers the
 * questions other capabilities ask (`ownerOf`, `canAssign`) by delegating here.
 */
export class AgentOwnershipService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectAgentRooms() private readonly rooms: AgentRooms,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly directory: WorkspaceMemberDirectoryService,
    ) {}

    /**
     * Who answers for an agent now: the stored owner while they are an active member, else the stored fallback, else the workspace
     * owner. The person after them is the next of the same chain. Called by the approval and chain engines, which have already
     * proven the workspace.
     */
    async ownerOf(agentId: string): Promise<AgentOwners> {
        const agent = await this.ownershipRow(agentId)
        const stored = [agent.ownerMemberId, agent.fallbackMemberId].filter((id): id is string => id !== null)
        const [active, workspaceOwner] = await Promise.all([
            this.seats.activeIdsAmong(agent.workspaceId, stored, MEMBER_LIMIT),
            this.workspaceOwnerOf(agent.workspaceId),
        ])
        return this.responderOf(agent, new Set(active), workspaceOwner)
    }

    /** Whether a member may hand an agent work: by role or by a seat in a team-chat group the agent is open to; nobody may for a paused agent. */
    async canAssign(memberId: string, agentId: string): Promise<boolean> {
        const agent = await this.entityManager.findOne(AgentEntity, { where: { id: agentId } })
        if (agent === null) return false
        const member = await this.seats.seatById(agent.workspaceId, memberId)
        if (member === null) return false
        const rooms = await this.seatRooms(agent.workspaceId, [member.userId])
        const context: AssignContext = {
            role: member.role,
            memberStatus: member.status,
            agentStatus: agent.status,
            assignableRoles: agent.assignableRoles,
            assignableRooms: agent.assignableRooms,
            memberRooms: rooms.map((room) => room.key),
        }
        return mayAssign(context)
    }

    /** Whether the account of a workspace manages an agent: by role or by a seat in a room the agent is open to, paused or not. */
    async canManage(workspaceId: string, userId: string, agentId: string): Promise<boolean> {
        const agent = await this.entityManager.findOne(AgentEntity, { where: { id: agentId, workspaceId } })
        if (agent === null) return false
        const member = await this.seats.activeSeatOfUser(workspaceId, userId)
        if (member === null) return false
        const rooms = await this.seatRooms(workspaceId, [userId])
        return mayManage({
            role: member.role,
            memberStatus: member.status,
            agentStatus: agent.status,
            assignableRoles: agent.assignableRoles,
            assignableRooms: agent.assignableRooms,
            memberRooms: rooms.map((room) => room.key),
        })
    }

    /** The member id (workspace_members.id) of a signed-in account; the account must belong to the workspace. */
    async memberIdOf(userId: string, workspaceId: string): Promise<string> {
        await this.members.require(userId, workspaceId)
        const id = await this.directory.idOfUser(workspaceId, userId)
        if (id === null) throw this.invalidOwnership("member")
        return id
    }

    /** Who answers for an agent and who may give it work; any member of the workspace may read it. */
    async ownershipOf(userId: string, workspaceId: string, agentId: string): Promise<AgentOwnership> {
        await this.members.require(userId, workspaceId)
        const agent = await this.ownershipRow(agentId, workspaceId)
        const stored = [agent.ownerMemberId, agent.fallbackMemberId].filter((id): id is string => id !== null)
        const [states, workspaceOwner, rooms] = await Promise.all([
            this.memberStates(workspaceId, stored),
            this.workspaceOwnerOf(workspaceId),
            this.roomLabels(workspaceId, agent.assignableRooms),
        ])
        const active = new Set(states.filter((state) => state.status === "active").map((state) => state.id))
        const cardOf = (id: string | null) => {
            const state = states.find((candidate) => candidate.id === id)
            return state === undefined ? null : ownerCardOf(state)
        }
        return {
            agentId: agent.id,
            owner: cardOf(agent.ownerMemberId),
            fallback: cardOf(agent.fallbackMemberId),
            responder: this.responderOf(agent, active, workspaceOwner),
            assignableRoles: rolesOf(agent.assignableRoles),
            assignableRooms: rooms,
        }
    }

    /** Replaces who is in charge of an agent and who may give it work; a manager only. */
    async setOwnership(userId: string, workspaceId: string, agentId: string, change: OwnershipChange): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        const people = [...new Set([change.ownerMemberId, change.fallbackMemberId])]
        const roles = [...new Set(change.assignableRoles)]
        const rooms = [...new Set(change.assignableRooms)]
        if (!(await this.membersCounted(workspaceId, people))) throw this.invalidOwnership("owner")
        if (!roles.every(isAssignableRole)) throw this.invalidOwnership("assignableRoles")
        if (!(await this.roomsCounted(workspaceId, rooms))) throw this.invalidOwnership("assignableRooms")
        this.expectChanged(
            await this.entityManager.update(
                AgentEntity,
                { id: agentId, workspaceId },
                {
                    ownerMemberId: change.ownerMemberId,
                    fallbackMemberId: change.fallbackMemberId,
                    assignableRoles: roles,
                    assignableRooms: rooms,
                },
            ),
            agentId,
        )
    }

    private invalidOwnership(field: string): AgentsError {
        return new AgentsError({ code: AgentsErrorCode.OwnershipInvalid, params: { field } })
    }

    /** True when every given member (there is always at least the owner) is an active member of the workspace. */
    private async membersCounted(workspaceId: string, ids: ReadonlyArray<string>): Promise<boolean> {
        const counted = await this.seats.countActiveAmong(workspaceId, ids)
        return counted === ids.length
    }

    /** True when every given room is a team-chat group of the workspace; an empty list is trivially so. */
    private async roomsCounted(workspaceId: string, ids: ReadonlyArray<string>): Promise<boolean> {
        if (ids.length === 0) return true
        return (await this.rooms.labelsOf(workspaceId, ids, ids.length)).length === ids.length
    }

    private async ownershipRow(agentId: string, workspaceId: string | null = null): Promise<AgentEntity> {
        const row = await this.entityManager.findOne(AgentEntity, { where: { id: agentId } })
        if (row === null || (workspaceId !== null && row.workspaceId !== workspaceId))
            throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
        return row
    }

    private async workspaceOwnerOf(workspaceId: string): Promise<string | null> {
        const [row] = await callDbFunction<WorkspaceOwnerRow>(this.entityManager, "public.workspace_owner_member", [
            workspaceId,
        ])
        return row?.workspace_owner_member ?? null
    }

    private responderOf(agent: AgentEntity, active: ReadonlySet<string>, workspaceOwner: string | null): AgentOwners {
        const owners = resolveOwners(agent, active, workspaceOwner)
        if (owners === null) throw new AgentsError({ code: AgentsErrorCode.OwnerUnavailable })
        return owners
    }

    /** The given members with the first team-chat group each sits in. */
    private async memberStates(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<MemberState>> {
        const members = await this.seats.seatsByIds(workspaceId, ids, MEMBER_LIMIT)
        const rooms = await this.seatRooms(
            workspaceId,
            members.map((member) => member.userId),
        )
        return members.map((member) => ({
            id: member.memberId,
            displayName: member.displayName,
            role: member.role,
            status: member.status,
            roomKey: rooms.find((room) => room.userId === member.userId)?.key ?? null,
        }))
    }

    /** The names of the team-chat groups of a workspace by room id. */
    private roomLabels(workspaceId: string, keys: ReadonlyArray<string>): Promise<ReadonlyArray<RoomLabel>> {
        return this.rooms.labelsOf(workspaceId, keys, ROOM_LIMIT)
    }

    /** The team-chat groups the given accounts sit in, the first group of each account first. */
    private seatRooms(workspaceId: string, userIds: ReadonlyArray<string>): Promise<ReadonlyArray<SeatRoomRow>> {
        return this.rooms.seatRoomsOf(workspaceId, userIds, MEMBER_ROOMS_LIMIT)
    }

    private expectChanged(result: UpdateResult, agentId: string): void {
        if ((result.affected ?? 0) === 0)
            throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
    }
}
