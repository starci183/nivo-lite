import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
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
import type { IdRow } from "./persistence/agents.rows"
import {
    COUNT_ACTIVE_MEMBERS,
    COUNT_WORKSPACE_AGENTS,
    FIND_ASSIGN_CONTEXT,
    FIND_MEMBER_ID,
    FIND_OWNERSHIP,
    FIND_TAG_CONTEXT,
    FIND_WORKSPACE_OWNER,
    LIST_ACTIVE_MEMBER_IDS,
    LIST_MEMBER_STATES,
    LIST_ROOM_LABELS,
    LIST_TAG_TARGETS,
    SET_OWNERSHIP,
} from "./persistence/agents.sql"
import type {
    ActiveMemberRow,
    AssignContextRow,
    CountRow,
    MemberIdRow,
    MemberStateRow,
    OwnershipRow,
    RoomLabelRow,
    TagContextRow,
    TagTargetRow,
} from "./persistence/ownership.rows"

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
    ) {}

    /**
     * Who answers for an agent now: the stored owner while they are an active member, else the stored fallback, else the workspace
     * owner. The person after them is the next of the same chain. Called by the approval and chain engines, which have already
     * proven the workspace.
     */
    async ownerOf(agentId: string): Promise<AgentOwners> {
        const agent = await this.ownershipRow(agentId)
        const stored = [agent.owner_member_id, agent.fallback_member_id].filter((id): id is string => id !== null)
        const [active, workspaceOwner] = await Promise.all([
            this.entityManager.query<Array<ActiveMemberRow>>(LIST_ACTIVE_MEMBER_IDS, [agent.workspace_id, stored]),
            this.workspaceOwnerOf(agent.workspace_id),
        ])
        return this.responderOf(agent, new Set(active.map((row) => row.id)), workspaceOwner)
    }

    /** Whether an agent may pass work to another agent: both active, one workspace, the second on the first's list. */
    async canTag(agentId: string, targetAgentId: string): Promise<boolean> {
        const [context] = await this.entityManager.query<Array<TagContextRow>>(FIND_TAG_CONTEXT, [
            agentId,
            targetAgentId,
        ])
        return context !== undefined && mayTag(context)
    }

    /** Whether a member may hand an agent work: by role or by a seat in a room the agent is open to; nobody may for a paused agent. */
    async canAssign(memberId: string, agentId: string): Promise<boolean> {
        const [context] = await this.entityManager.query<Array<AssignContextRow>>(FIND_ASSIGN_CONTEXT, [
            agentId,
            memberId,
        ])
        return context !== undefined && mayAssign(context)
    }

    /** The member id (workspace_members.id) of a signed-in account; the account must belong to the workspace. */
    async memberIdOf(userId: string, workspaceId: string): Promise<string> {
        await this.members.require(userId, workspaceId)
        const [row] = await this.entityManager.query<Array<MemberIdRow>>(FIND_MEMBER_ID, [workspaceId, userId])
        const id = row?.id ?? null
        if (id === null) throw this.invalidOwnership("member")
        return id
    }

    /** Who answers for an agent, who may give it work and who it may pass work to; any member of the workspace may read it. */
    async ownershipOf(userId: string, workspaceId: string, agentId: string): Promise<AgentOwnership> {
        await this.members.require(userId, workspaceId)
        const agent = await this.ownershipRow(agentId, workspaceId)
        const stored = [agent.owner_member_id, agent.fallback_member_id].filter((id): id is string => id !== null)
        const [states, workspaceOwner, rooms, targets] = await Promise.all([
            this.entityManager.query<Array<MemberStateRow>>(LIST_MEMBER_STATES, [workspaceId, stored]),
            this.workspaceOwnerOf(workspaceId),
            this.entityManager.query<Array<RoomLabelRow>>(LIST_ROOM_LABELS, [workspaceId, agent.assignable_rooms]),
            this.entityManager.query<Array<TagTargetRow>>(LIST_TAG_TARGETS, [workspaceId, agent.can_tag_agent_ids]),
        ])
        const active = new Set(states.filter((state) => state.status === "active").map((state) => state.id))
        const cardOf = (id: string | null) => {
            const state = states.find((candidate) => candidate.id === id)
            return state === undefined ? null : ownerCardOf(state)
        }
        return {
            agentId: agent.id,
            owner: cardOf(agent.owner_member_id),
            fallback: cardOf(agent.fallback_member_id),
            responder: this.responderOf(agent, active, workspaceOwner),
            assignableRoles: rolesOf(agent.assignable_roles),
            assignableRooms: rooms,
            canTag: targets,
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
            await this.entityManager.query<Array<IdRow>>(SET_OWNERSHIP, [
                agentId,
                workspaceId,
                change.ownerMemberId,
                change.fallbackMemberId,
                roles,
                rooms,
                targets,
            ]),
            agentId,
        )
    }

    private invalidOwnership(field: string): AgentsError {
        return new AgentsError({ code: AgentsErrorCode.OwnershipInvalid, params: { field } })
    }

    /** True when every given member (there is always at least the owner) is an active member of the workspace. */
    private async membersCounted(workspaceId: string, ids: ReadonlyArray<string>): Promise<boolean> {
        const [row] = await this.entityManager.query<Array<CountRow>>(COUNT_ACTIVE_MEMBERS, [workspaceId, ids])
        return row?.n === ids.length
    }

    /** True when every given agent belongs to the workspace; an empty list is trivially so. */
    private async agentsCounted(workspaceId: string, ids: ReadonlyArray<string>): Promise<boolean> {
        if (ids.length === 0) return true
        const [row] = await this.entityManager.query<Array<CountRow>>(COUNT_WORKSPACE_AGENTS, [workspaceId, ids])
        return row?.n === ids.length
    }

    private async ownershipRow(agentId: string, workspaceId: string | null = null): Promise<OwnershipRow> {
        const [row] = await this.entityManager.query<Array<OwnershipRow>>(FIND_OWNERSHIP, [agentId])
        if (row === undefined || (workspaceId !== null && row.workspace_id !== workspaceId))
            throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
        return row
    }

    private async workspaceOwnerOf(workspaceId: string): Promise<string | null> {
        const [row] = await this.entityManager.query<Array<MemberIdRow>>(FIND_WORKSPACE_OWNER, [workspaceId])
        return row?.id ?? null
    }

    private responderOf(agent: OwnershipRow, active: ReadonlySet<string>, workspaceOwner: string | null): AgentOwners {
        const owners = resolveOwners(agent, active, workspaceOwner)
        if (owners === null) throw new AgentsError({ code: AgentsErrorCode.OwnerUnavailable })
        return owners
    }

    private expectChanged(rows: ReadonlyArray<IdRow>, agentId: string): void {
        if (rows.length === 0) throw new AgentsError({ code: AgentsErrorCode.AgentNotFound, params: { id: agentId } })
    }
}
