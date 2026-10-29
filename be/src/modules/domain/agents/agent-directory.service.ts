import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AgentCard,
    AgentCreation,
    OptionalAgentHeader,
    OptionalAgentChatFacts,
    OptionalAgentTurnFacts,
    AgentModuleRef,
    OptionalAgentStatus,
    OptionalGreeting,
    AgentHandleCard,
    AgentIdentityCard,
    AgentSeat,
    AgentSheet,
    OptionalAgentCard,
    OptionalAgentSheet,
} from "./agent-directory.contracts"
import type { OptionalId } from "./agents.contracts"
import { AgentEntity } from "./persistence/entities"

const CARD_COLUMNS = { id: true, name: true, module: true, canTagAgentIds: true } as const

/** The sortable text of a creation instant: digits only, fixed width, microsecond exact, so text order is time order. */
const SEAT_AT = "to_char(a.created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')"

const SHEET_COLUMNS = {
    id: true,
    module: true,
    name: true,
    handle: true,
    role: true,
    instructions: true,
    knowledge: true,
    greeting: true,
    approvalRule: true,
    status: true,
    createdAt: true,
} as const

const toSheet = (agent: AgentEntity): AgentSheet => ({
    id: agent.id,
    module: agent.module,
    name: agent.name,
    handle: agent.handle,
    role: agent.role,
    instructions: agent.instructions,
    knowledge: agent.knowledge,
    greeting: agent.greeting,
    approvalRule: agent.approvalRule,
    status: agent.status,
    createdAt: agent.createdAt,
})

const toCard = (agent: AgentEntity): AgentCard => ({
    id: agent.id,
    name: agent.name,
    module: agent.module,
    canTagAgentIds: agent.canTagAgentIds,
})

@Injectable()
/** Request-time agent lookups for other capabilities: names, handles and cards, always bounded by the caller. */
export class AgentDirectoryService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The active agents of a workspace by name. */
    async activeOf(workspaceId: string, limit: number): Promise<Array<AgentCard>> {
        const agents = await this.entityManager.find(AgentEntity, {
            select: CARD_COLUMNS,
            where: { workspaceId, status: "active" },
            order: { name: "ASC" },
            take: limit,
        })
        return agents.map(toCard)
    }

    /** The active agents among the given ids, in the order the ids are given. */
    async activeInOrder(
        workspaceId: string,
        agentIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<AgentCard>> {
        if (agentIds.length === 0) return []
        const agents = await this.entityManager.find(AgentEntity, {
            select: CARD_COLUMNS,
            where: { workspaceId, status: "active", id: In([...agentIds]) },
            take: agentIds.length,
        })
        const byId = new Map(agents.map((agent) => [agent.id, toCard(agent)]))
        return agentIds.flatMap((id) => byId.get(id) ?? []).slice(0, limit)
    }

    /** The active agents among the given ids with the moment each was created, oldest first, at most `limit`. */
    async activeCreatedAmong(
        workspaceId: string,
        agentIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<AgentCreation>> {
        if (agentIds.length === 0) return []
        const agents = await this.entityManager.find(AgentEntity, {
            select: { id: true, module: true, name: true, createdAt: true },
            where: { workspaceId, status: "active", id: In([...new Set(agentIds)]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return agents.map((agent) => ({
            id: agent.id,
            module: agent.module,
            name: agent.name,
            createdAt: agent.createdAt,
        }))
    }

    /** Whether the workspace holds the agent; the row is read with a shared lock so it stays until the transaction ends. */
    async holds(workspaceId: string, agentId: string, manager: EntityManager): Promise<boolean> {
        const agent = await manager.findOne(AgentEntity, {
            select: { id: true },
            where: { id: agentId, workspaceId },
            lock: { mode: "pessimistic_read" },
        })
        return agent !== null
    }

    /** The status of the agent in the workspace; null when the workspace has no such agent. */
    async statusOf(workspaceId: string, agentId: string): Promise<OptionalAgentStatus> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: { id: true, status: true },
            where: { id: agentId, workspaceId },
        })
        return agent?.status ?? null
    }

    /** The agents of the workspace with the module each serves, whatever their status, oldest first, at most `limit`. */
    async moduleRefsOf(workspaceId: string, limit: number): Promise<Array<AgentModuleRef>> {
        const agents = await this.entityManager.find(AgentEntity, {
            select: { id: true, module: true },
            where: { workspaceId },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return agents.map((agent) => ({ id: agent.id, module: agent.module }))
    }

    /** The facts the chat page needs of the agent in the workspace; null when the workspace has no such agent. */
    async chatFactsOf(workspaceId: string, agentId: string): Promise<OptionalAgentChatFacts> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: { id: true, module: true, status: true, greeting: true },
            where: { workspaceId, id: agentId },
        })
        return agent === null
            ? null
            : { id: agent.id, module: agent.module, status: agent.status, greeting: agent.greeting }
    }

    /** The agent that speaks in a conversation turn, with the texts that steer it; null when there is no such agent. */
    async turnFactsOf(agentId: string): Promise<OptionalAgentTurnFacts> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: {
                id: true,
                name: true,
                handle: true,
                role: true,
                module: true,
                instructions: true,
                knowledge: true,
                approvalRule: true,
                greeting: true,
            },
            where: { id: agentId },
        })
        return agent === null
            ? null
            : {
                  id: agent.id,
                  name: agent.name,
                  handle: agent.handle,
                  role: agent.role,
                  module: agent.module,
                  instructions: agent.instructions,
                  knowledge: agent.knowledge,
                  approvalRule: agent.approvalRule,
                  greeting: agent.greeting,
              }
    }

    /** One agent of the workspace by id, active or paused; null when there is none. */
    async find(workspaceId: string, agentId: string): Promise<OptionalAgentCard> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: CARD_COLUMNS,
            where: { workspaceId, id: agentId },
        })
        return agent === null ? null : toCard(agent)
    }

    /** One active agent of the workspace by id; null when there is none or it is paused. */
    async findActive(workspaceId: string, agentId: string): Promise<OptionalAgentCard> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: CARD_COLUMNS,
            where: { workspaceId, id: agentId, status: "active" },
        })
        return agent === null ? null : toCard(agent)
    }

    /** The cards of the given agents of a workspace, in no particular order (a missing id is missing from the answer). */
    async cardsOf(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<Array<AgentCard>> {
        if (agentIds.length === 0) return []
        const agents = await this.entityManager.find(AgentEntity, {
            select: CARD_COLUMNS,
            where: { workspaceId, id: In([...agentIds]) },
            take: agentIds.length,
        })
        return agents.map(toCard)
    }

    /** The id of the oldest active agent of a module in the workspace; null when the department has none. */
    async firstActiveIdOfModule(workspaceId: string, module: string): Promise<OptionalId> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: { id: true },
            where: { workspaceId, module, status: "active" },
            order: { createdAt: "ASC" },
        })
        return agent?.id ?? null
    }

    /** The handles every agent of the workspace holds. */
    async handlesOf(workspaceId: string, limit: number): Promise<Array<string>> {
        const agents = await this.entityManager.find(AgentEntity, {
            select: { handle: true },
            where: { workspaceId },
            take: limit,
        })
        return agents.map((agent) => agent.handle)
    }

    /** How many agents the workspace has, active or paused. */
    countOf(workspaceId: string): Promise<number> {
        return this.entityManager.count(AgentEntity, { where: { workspaceId } })
    }

    /** The oldest agents of the workspace as seats, oldest first (ties by id). */
    firstSeats(workspaceId: string, limit: number): Promise<Array<AgentSeat>> {
        return this.seatsQuery(workspaceId)
            .orderBy("a.createdAt")
            .addOrderBy("a.id")
            .limit(limit)
            .getRawMany<AgentSeat>()
    }

    /** The given agents of the workspace as seats, in no particular order (a missing id is missing from the answer). */
    seatsOf(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<Array<AgentSeat>> {
        if (agentIds.length === 0) return Promise.resolve([])
        return this.seatsQuery(workspaceId)
            .andWhere("a.id IN (:...agentIds)", { agentIds: [...new Set(agentIds)] })
            .getRawMany<AgentSeat>()
    }

    /** The ids of the agents of the workspace in id order, bounded. */
    async idsOf(workspaceId: string, limit: number): Promise<Array<string>> {
        const agents = await this.entityManager.find(AgentEntity, {
            select: { id: true },
            where: { workspaceId },
            order: { id: "ASC" },
            take: limit,
        })
        return agents.map((agent) => agent.id)
    }

    /** The active agents of the workspace holding one of the handles, in handle order, bounded. */
    async activeByHandles(
        workspaceId: string,
        handles: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<AgentHandleCard>> {
        const agents = await this.entityManager.find(AgentEntity, {
            select: { id: true, handle: true, module: true, name: true },
            where: { workspaceId, status: "active", handle: In([...handles]) },
            order: { handle: "ASC" },
            take: limit,
        })
        return agents.map((agent) => ({ id: agent.id, handle: agent.handle, module: agent.module, name: agent.name }))
    }

    /** How many active agents of the workspace work in one of the modules (departments). */
    activeCountOfModules(workspaceId: string, modules: ReadonlyArray<string>): Promise<number> {
        return this.entityManager.count(AgentEntity, {
            where: { workspaceId, status: "active", module: In([...modules]) },
        })
    }

    /** Who the given agents of the workspace are (name, handle, picture), in no particular order (a missing id is missing from the answer). */
    async identitiesOf(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<Array<AgentIdentityCard>> {
        if (agentIds.length === 0) return []
        const agents = await this.entityManager.find(AgentEntity, {
            select: { id: true, name: true, handle: true, avatarUrl: true },
            where: { workspaceId, id: In([...new Set(agentIds)]) },
            take: new Set(agentIds).size,
        })
        return agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            handle: agent.handle,
            avatarUrl: agent.avatarUrl,
        }))
    }

    /** The agents of a workspace with their whole sheet, oldest first, bounded by the caller. */
    async sheetsOf(workspaceId: string, limit: number): Promise<Array<AgentSheet>> {
        const agents = await this.entityManager.find(AgentEntity, {
            select: SHEET_COLUMNS,
            where: { workspaceId },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return agents.map(toSheet)
    }

    /** The oldest agent of a module in the workspace, active or paused, with its whole sheet; null when the department has none. */
    async earliestSheetOfModule(workspaceId: string, module: string): Promise<OptionalAgentSheet> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: SHEET_COLUMNS,
            where: { workspaceId, module },
            order: { createdAt: "ASC", id: "ASC" },
        })
        return agent === null ? null : toSheet(agent)
    }

    /** The header of an agent of the workspace; null when the agent is not there. */
    async headOf(workspaceId: string, agentId: string): Promise<OptionalAgentHeader> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: { id: true, name: true, handle: true, role: true, module: true, status: true, avatarUrl: true },
            where: { workspaceId, id: agentId },
        })
        return agent === null
            ? null
            : {
                  id: agent.id,
                  name: agent.name,
                  handle: agent.handle,
                  role: agent.role,
                  module: agent.module,
                  status: agent.status,
                  avatarUrl: agent.avatarUrl,
              }
    }

    /** The greeting that opens a visit with an agent of the workspace; null when the agent is not there. */
    async greetingOf(workspaceId: string, agentId: string): Promise<OptionalGreeting> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: { greeting: true },
            where: { workspaceId, id: agentId },
        })
        return agent === null ? null : agent.greeting
    }

    /** The oldest active agent of a module in the workspace; null when the department has none. */
    async firstActiveCardOfModule(workspaceId: string, module: string): Promise<OptionalAgentCard> {
        const agent = await this.entityManager.findOne(AgentEntity, {
            select: CARD_COLUMNS,
            where: { workspaceId, module, status: "active" },
            order: { createdAt: "ASC", id: "ASC" },
        })
        return agent === null ? null : toCard(agent)
    }

    private seatsQuery(workspaceId: string): SelectQueryBuilder<AgentEntity> {
        return this.entityManager
            .createQueryBuilder(AgentEntity, "a")
            .select("a.id", "id")
            .addSelect("a.name", "name")
            .addSelect("a.module", "module")
            .addSelect("a.avatarUrl", "avatar_url")
            .addSelect(SEAT_AT, "at")
            .where("a.workspaceId = :workspaceId", { workspaceId })
    }
}
