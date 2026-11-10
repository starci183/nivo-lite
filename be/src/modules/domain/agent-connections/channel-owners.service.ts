import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectBindingAgents } from "./agent-connections.decorators"
import type { BindingAgentsDirectory } from "./agent-connections.port"
import type { ChannelClaim, ChannelConflict, ChannelHolder, OptionalChannelOwner } from "./agent-connections.contracts"
import {
    CHANNEL_PURPOSES,
    channelOwnerOf,
    isChannelPurpose,
    ownersByConnection,
    ownershipConflictOf,
} from "./channel-ownership.policy"
import { AgentConnectionsError, AgentConnectionsErrorCode } from "./errors/agent-connections.error"
import { AgentConnectionEntity } from "./persistence/entities"

/** Which channel grants an ownership read weighs: those of a workspace, of a connection, or both. */
interface HoldersWhere {
    readonly workspaceId?: string
    readonly connectionId?: string
}

/** The most grants one ownership read weighs. */
const HOLDERS_MAX = 500

@Injectable()
/**
 * Which agent of a role answers a channel connection (one role, many agents). Each inbound channel connection is answered by exactly
 * ONE agent of a role: the routing asks `ownerOf` which Sales agent a conversation on a connection goes to, the create dialog asks
 * `ownersOf` which channels another agent already answers, and every grant writer asks `conflictOf` before it writes. Only active agents
 * count; a grant that only reads never owns.
 */
export class ChannelOwnersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectBindingAgents() private readonly agents: BindingAgentsDirectory,
    ) {}

    /** The one agent of `module` that answers the connection, or null when no agent of that role does. */
    async ownerOf(connectionId: string, module: string): Promise<OptionalChannelOwner> {
        return channelOwnerOf(await this.holdersWhere({ connectionId }, this.entityManager), module)
    }

    /** Every channel connection of the workspace an agent of `module` answers, with that agent; one entry per connection. */
    async ownersOf(workspaceId: string, module: string): Promise<ReadonlyArray<ChannelHolder>> {
        return ownersByConnection(await this.holdersWhere({ workspaceId }, this.entityManager), module)
    }

    /**
     * The channels an agent holds that another active agent of its role answers, one entry per connection: what resuming the agent
     * would turn into two agents answering one channel. Only the channels the agent would answer count (it reads, or no purpose of
     * a channel, never conflicts).
     */
    async conflictsOfAgent(
        workspaceId: string,
        agentId: string,
        module: string,
    ): Promise<ReadonlyArray<ChannelConflict>> {
        const mine = await this.entityManager.find(AgentConnectionEntity, {
            where: { workspaceId, agentId, purpose: In([...CHANNEL_PURPOSES]) },
            order: { createdAt: "ASC" },
            take: HOLDERS_MAX,
        })
        if (mine.length === 0) return []
        const holders = await this.holdersWhere({ workspaceId }, this.entityManager)
        return mine.flatMap((link) => {
            const owner = ownershipConflictOf(
                holders.filter((holder) => holder.connectionId === link.connectionId),
                { agentId, module, purpose: link.purpose },
            )
            return owner === null ? [] : [{ connectionId: link.connectionId, owner }]
        })
    }

    /**
     * The agent that already answers the connection for the role of the claim, when writing the claim would give the role a second
     * one; null when the claim may be written. Read inside the caller's transaction.
     */
    async conflictOf(
        workspaceId: string,
        connectionId: string,
        claim: ChannelClaim,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalChannelOwner> {
        if (!isChannelPurpose(claim.purpose)) return null
        return ownershipConflictOf(await this.holdersWhere({ workspaceId, connectionId }, manager), claim)
    }

    /**
     * Refuses a claim that would give its role a second agent answering the channel connection, naming the agent that answers it;
     * read inside the caller's transaction. A claim that only reads, or of a purpose that is no channel, passes.
     */
    async requireFree(
        workspaceId: string,
        connectionId: string,
        claim: ChannelClaim,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        const owner = await this.conflictOf(workspaceId, connectionId, claim, manager)
        if (owner === null) return
        throw new AgentConnectionsError({
            code: AgentConnectionsErrorCode.ChannelOwned,
            params: { agent: owner.agentName, agentId: owner.agentId, connectionId },
        })
    }

    /** The channel grants matching the condition, joined to their active agents. */
    private async holdersWhere(where: HoldersWhere, manager: EntityManager): Promise<ReadonlyArray<ChannelHolder>> {
        const links = await manager.find(AgentConnectionEntity, {
            where: { ...where, purpose: In([...CHANNEL_PURPOSES]) },
            order: { createdAt: "ASC" },
            take: HOLDERS_MAX,
        })
        const [first] = links
        if (first === undefined) return []
        const agents = await this.agents.activeCreatedAmong(
            first.workspaceId,
            [...new Set(links.map((link) => link.agentId))],
            HOLDERS_MAX,
        )
        const byId = new Map(agents.map((agent) => [agent.id, agent]))
        return links.flatMap((link): ReadonlyArray<ChannelHolder> => {
            const agent = byId.get(link.agentId)
            if (agent === undefined || !isChannelPurpose(link.purpose)) return []
            return [
                {
                    connectionId: link.connectionId,
                    agentId: agent.id,
                    agentName: agent.name,
                    module: agent.module,
                    purpose: CHANNEL_PURPOSES.find((purpose) => purpose === link.purpose) ?? "inbound_chat",
                    grantedAt: link.createdAt,
                },
            ]
        })
    }
}
