import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager, UpdateResult } from "typeorm"
import { WorkspaceMemberEntity, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    ROOM_KEYS,
    isAssignableRole,
    mayAssign,
    mayTag,
    ownerCardOf,
    resolveOwners,
    rolesOf,
} from "./agent-ownership.policy"
import type { AgentOwners, AgentOwnership, OwnershipChange } from "./agents.contracts"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import type { AssignContext, MemberState, TagContext } from "./agents-reads.contracts"
import { AgentEntity } from "./persistence/entities"

/** The room keys and cards ownership reads are bounded by what one agent can name. */
const MEMBER_LIMIT = 10
const ROOM_LIMIT = 10
const MEMBER_ROOMS_LIMIT = 50
const TAG_LIMIT = 50

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
 * Who answers for each agent, who may hand it work and which agents it may pass work to: the ownership settings of the agents
 * table. `AgentsService` offers the three questions other capabilities ask (`ownerOf`, `canTag`, `canAssign`) by delegating here.
 */
export class AgentOwnershipService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly rooms: OfficeRoomDirectoryService,
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
            this.entityManager.find(WorkspaceMemberEntity, {
                select: { id: true },
                where: { workspaceId: agent.workspaceId, id: In(stored), status: "active" },
                take: MEMBER_LIMIT,
            }),
            this.workspaceOwnerOf(agent.workspaceId),
        ])
        return this.responderOf(agent, new Set(active.map((row) => row.id)), workspaceOwner)
    }

    /** Whether an agent may pass work to another agent: both active, one workspace, the second on the first's list. */
    async canTag(agentId: string, targetAgentId: string): Promise<boolean> {
        const agents = await this.entityManager.find(AgentEntity, {
            where: { id: In([agentId, targetAgentId]) },
            take: 2,
        })
        const from = agents.find((agent) => agent.id === agentId)
        const to = agents.find((agent) => agent.id === targetAgentId)
        if (from === undefined || to === undefined) return false
        const context: TagContext = {
            fromStatus: from.status,
            toStatus: to.status,
            sameWorkspace: from.workspaceId === to.workspaceId,
            listed: from.canTagAgentIds.includes(to.id),
            sameAgent: from.id === to.id,
        }
        return mayTag(context)
    }

    /** Whether a member may hand an agent work: by role or by a seat in a room the agent is open to; nobody may for a paused agent. */
    async canAssign(memberId: string, agentId: string): Promise<boolean> {
        const agent = await this.entityManager.findOne(AgentEntity, { where: { id: agentId } })
        if (agent === null) return false
        const member = await this.entityManager.findOne(WorkspaceMemberEntity, {
            where: { id: memberId, workspaceId: agent.workspaceId },
        })
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

    /** The member id (workspace_members.id) of a signed-in account; the account must belong to the workspace. */
    async memberIdOf(userId: string, workspaceId: string): Promise<string> {
        await this.members.require(userId, workspaceId)
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: { id: true },
            where: { workspaceId, userId },
        })
        const id = row?.id ?? null
        if (id === null) throw this.invalidOwnership("member")
        return id
    }

    /** Who answers for an agent, who may give it work and who it may pass work to; any member of the workspace may read it. */
    async ownershipOf(userId: string, workspaceId: string, agentId: string): Promise<AgentOwnership> {
        await this.members.require(userId, workspaceId)
        const agent = await this.ownershipRow(agentId, workspaceId)
        const stored = [agent.ownerMemberId, agent.fallbackMemberId].filter((id): id is string => id !== null)
        const [states, workspaceOwner, rooms, targets] = await Promise.all([
            this.memberStates(workspaceId, stored),
            this.workspaceOwnerOf(workspaceId),
            this.roomLabels(workspaceId, agent.assignableRooms),
            this.entityManager.find(AgentEntity, {
                select: { id: true, name: true, module: true, status: true },
                where: { workspaceId, id: In(agent.canTagAgentIds) },
                order: { createdAt: "ASC", id: "ASC" },
                take: TAG_LIMIT,
            }),
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
            canTag: targets.map((target) => ({
                id: target.id,
                name: target.name,
                module: target.module,
                status: target.status,
            })),
        }
    }

    /** Replaces who is in charge of an agent, who may give it work and who it may pass work to; a manager only. */
    async setOwnership(userId: string, workspaceId: string, agentId: string, change: OwnershipChange): Promise<void> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        const people = [...new Set([change.ownerMemberId, change.fallbackMemberId])]
        const roles = [...new Set(change.assignableRoles)]
        const rooms = [...new Set(change.assignableRooms)]
        const targets = [...new Set(change.canTagAgentIds)]
        if (!(await this.membersCounted(workspaceId, people))) throw this.invalidOwnership("owner")
        if (!roles.every(isAssignableRole)) throw this.invalidOwnership("assignableRoles")
        if (!rooms.every((room) => ROOM_KEYS.includes(room))) throw this.invalidOwnership("assignableRooms")
        if (targets.includes(agentId) || !(await this.agentsCounted(workspaceId, targets)))
            throw this.invalidOwnership("canTagAgentIds")
        this.expectChanged(
            await this.entityManager.update(
                AgentEntity,
                { id: agentId, workspaceId },
                {
                    ownerMemberId: change.ownerMemberId,
                    fallbackMemberId: change.fallbackMemberId,
                    assignableRoles: roles,
                    assignableRooms: rooms,
                    canTagAgentIds: targets,
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
        const counted = await this.entityManager.count(WorkspaceMemberEntity, {
            where: { workspaceId, id: In([...ids]), status: "active" },
        })
        return counted === ids.length
    }

    /** True when every given agent belongs to the workspace; an empty list is trivially so. */
    private async agentsCounted(workspaceId: string, ids: ReadonlyArray<string>): Promise<boolean> {
        if (ids.length === 0) return true
        const counted = await this.entityManager.count(AgentEntity, { where: { workspaceId, id: In([...ids]) } })
        return counted === ids.length
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

    /** The given members with the first department room each sits in. */
    private async memberStates(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<MemberState>> {
        const members = await this.entityManager.find(WorkspaceMemberEntity, {
            where: { workspaceId, id: In([...ids]) },
            take: MEMBER_LIMIT,
        })
        const rooms = await this.seatRooms(
            workspaceId,
            members.map((member) => member.userId),
        )
        return members.map((member) => ({
            id: member.id,
            displayName: member.displayName,
            role: member.role,
            status: member.status,
            roomKey: rooms.find((room) => room.userId === member.userId)?.key ?? null,
        }))
    }

    /** The names of the department rooms of a workspace by key. */
    private roomLabels(workspaceId: string, keys: ReadonlyArray<string>): Promise<ReadonlyArray<RoomLabel>> {
        return this.rooms.labelsOf(workspaceId, keys, ROOM_LIMIT)
    }

    /** The department rooms the given accounts sit in, the first room of each account first. */
    private seatRooms(workspaceId: string, userIds: ReadonlyArray<string>): Promise<ReadonlyArray<SeatRoomRow>> {
        return this.rooms.seatRoomsOf(workspaceId, userIds, MEMBER_ROOMS_LIMIT)
    }

    private expectChanged(result: UpdateResult, agentId: string): void {
        if ((result.affected ?? 0) === 0)
            throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
    }
}
