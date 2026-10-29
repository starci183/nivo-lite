import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NewAgent } from "./agents.contracts"
import { AgentsError, AgentsErrorCode } from "./errors/agents.error"
import { AgentEntity } from "./persistence/entities"

/**
 * The conflict clause of an agent kept by handle: a known handle takes the given module, name, role and instructions, and keeps
 * the NIVO setup block its applied context version wrote ("### NIVO setup v<n>" to "### end NIVO setup"): any block in the given
 * text is dropped and the kept one is appended once, so a re-run never loses the applied setup and never doubles it.
 */
const KEEP_SETUP_CONFLICT = `("workspace_id", "handle") DO UPDATE
SET "module" = EXCLUDED."module", "name" = EXCLUDED."name", "role" = EXCLUDED."role",
    "instructions" = concat_ws(
        repeat(chr(10), 2),
        nullif(
            btrim(
                regexp_replace(
                    regexp_replace(EXCLUDED."instructions", '### NIVO setup v.*?### end NIVO setup', '', 'g'),
                    '(' || chr(10) || '){3,}', repeat(chr(10), 2), 'g'
                ),
                ' ' || chr(9) || chr(10) || chr(13)
            ),
            ''
        ),
        substring("agents"."instructions" from '### NIVO setup v.*?### end NIVO setup')
    )`

@Injectable()
/**
 * The agent rows a configuration run keeps by handle, over the entity manager alone so the cli can compose it without the
 * OpenClaw engine. The caller has already proven the workspace owner; the Agents pages keep using AgentsService.
 */
export class AgentRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Inserts the agent, or updates the one that already has its handle, and answers its id. */
    async ensureByHandle(agent: NewAgent): Promise<string> {
        const result = await this.entityManager
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
            .onConflict(KEEP_SETUP_CONFLICT)
            .returning("id")
            .execute()
        const [row] = result.raw as Array<{ id: string }>
        if (row === undefined) throw new AgentsError({ code: AgentsErrorCode.NotCreated })
        return row.id
    }
}
