import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { AGENT_SERIAL_ATTEMPTS, agentSerialOf, defaultAgentName } from "./agent-name.policy"
import type { NewNamedAgent } from "./agent-name.contracts"
import type { AgentSummary } from "./agents.contracts"
import { summaryOf } from "./agents.mapper"
import type { AgentRecord } from "./agents.mapper"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

const UNIQUE_VIOLATION = "23505"
const GOVERNORS = ["owner", "manager"] as const

/** The unique index that holds the generated ids of one workspace apart. */
const SERIAL_CONSTRAINT = "agents_workspace_serial_key"

/** Whether a RETURNING row carries the id of a stored agent, the shape of the returned columns. */
const isAgentRecord = (value: unknown): value is AgentRecord =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

const isUniqueViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === UNIQUE_VIOLATION

/** Whether a unique violation is the one of the generated id (draw another), not of the handle. */
const isSerialViolation = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "constraint" in cause && cause.constraint === SERIAL_CONSTRAINT

/** The stored agent, or that its generated id is already taken in the workspace. */
type Inserted = AgentSummary | "serial-taken"

@Injectable()
/**
 * Adds an agent to a workspace. An agent given a role instead of a name starts as "Agent <role> #<generated id>" (the owner renames it
 * freely); the generated id is five digits, unique in the workspace by the table's index, and drawn again when it collides.
 */
export class AgentCreationService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectIds() private readonly ids: Ids,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Adds the agent; a manager only. The handle must be free. */
    async create(userId: string, agent: NewNamedAgent): Promise<AgentSummary> {
        await this.members.require(userId, agent.workspaceId, GOVERNORS)
        return this.insertDrawing(agent, AGENT_SERIAL_ATTEMPTS)
    }

    private async insertDrawing(agent: NewNamedAgent, attemptsLeft: number): Promise<AgentSummary> {
        if (attemptsLeft === 0) throw new AgentsError({ code: AgentsErrorCode.NotCreated })
        const outcome = await this.insert(agent, agentSerialOf(this.ids.next()))
        return outcome === "serial-taken" ? this.insertDrawing(agent, attemptsLeft - 1) : outcome
    }

    private async insert(agent: NewNamedAgent, serial: number): Promise<Inserted> {
        const name = typeof agent.name === "string" ? agent.name : defaultAgentName(agent.name.label, serial)
        const inserted = await this.entityManager
            .createQueryBuilder(AgentEntity, "ag")
            .insert()
            .values({
                workspaceId: agent.workspaceId,
                module: agent.module,
                name,
                serial,
                handle: agent.handle,
                role: agent.role,
                instructions: agent.instructions,
            })
            .returning(
                'id, module, name, handle, role, instructions, knowledge, approval_rule AS "approvalRule", status, avatar_url AS "avatarUrl", created_at AS "createdAt"',
            )
            .execute()
            .catch((cause: unknown): "serial-taken" => {
                if (!isUniqueViolation(cause)) throw cause
                if (isSerialViolation(cause)) return "serial-taken"
                throw new AgentsError({ code: AgentsErrorCode.HandleTaken, params: { handle: agent.handle }, cause })
            })
        if (inserted === "serial-taken") return inserted
        const [row] = Array.isArray(inserted.raw) ? inserted.raw.filter(isAgentRecord) : []
        if (row === undefined) throw new AgentsError({ code: AgentsErrorCode.NotCreated })
        return summaryOf(row)
    }
}
