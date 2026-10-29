import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NewAgent } from "./agents.contracts"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

/** The NIVO setup block an applied context version wrote ("### NIVO setup v<n>" to "### end NIVO setup"). */
const SETUP_BLOCK = /### NIVO setup v[\s\S]*?### end NIVO setup/

/** Whether a RETURNING row carries the id of the stored agent. */
const isIdRow = (value: unknown): value is { id: string } =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/**
 * The instructions of an agent kept by handle: any setup block in the given text is dropped and the one the stored text holds is
 * appended once, so a re-run never loses the applied setup and never doubles it.
 */
const keptInstructions = (given: string, stored: string): string => {
    const cleaned = given
        .replace(new RegExp(SETUP_BLOCK.source, "g"), "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    const kept = SETUP_BLOCK.exec(stored)?.[0] ?? ""
    return [cleaned, kept].filter((part) => part !== "").join("\n\n")
}

@Injectable()
/**
 * The agent rows a configuration run keeps by handle, over the entity manager alone so the cli can compose it without the
 * OpenClaw engine. The caller has already proven the workspace owner; the Agents pages keep using AgentsService.
 */
export class AgentRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Inserts the agent, or updates the one that already has its handle, and answers its id. A known handle takes the given module,
     * name, role and instructions and keeps its applied setup block; the stored row is locked while it is read and written.
     */
    ensureByHandle(agent: NewAgent): Promise<string> {
        return this.entityManager.transaction(async (manager) => {
            const inserted = await manager
                .createQueryBuilder(AgentEntity, "agents")
                .insert()
                .values({
                    workspaceId: agent.workspaceId,
                    module: agent.module,
                    name: agent.name,
                    handle: agent.handle,
                    role: agent.role,
                    instructions: agent.instructions,
                })
                .orIgnore()
                .returning("id")
                .execute()
            const [fresh] = Array.isArray(inserted.raw) ? inserted.raw.filter(isIdRow) : []
            if (fresh !== undefined) return fresh.id
            const stored = await manager.findOne(AgentEntity, {
                where: { workspaceId: agent.workspaceId, handle: agent.handle },
                lock: { mode: "pessimistic_write" },
            })
            if (stored === null) throw new AgentsError({ code: AgentsErrorCode.NotCreated })
            await manager.update(
                AgentEntity,
                { id: stored.id },
                {
                    module: agent.module,
                    name: agent.name,
                    role: agent.role,
                    instructions: keptInstructions(agent.instructions, stored.instructions),
                },
            )
            return stored.id
        })
    }
}
