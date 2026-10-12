import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OfficeLineInput, OptionalAgentIdentity, WorkContext } from "./decisions.contracts"
import { InjectAgentDirectory } from "./decisions.decorators"
import type { AgentDirectory } from "./decisions.port"
import { INSERT_MESSAGE } from "./persistence/office-lines.sql"

/** The author name of a plain NIVO Core line. */
export const CORE_LINE_AUTHOR = "NIVO"
/** The author name of a command mirror line; the Office keeps it a system line, never re-attributed to an agent. */
export const COMMAND_LINE_AUTHOR = "NIVO Bus"

@Injectable()
/** The Office thread: short lines linked to a work item, spoken by the department's own agent when it is installed. */
export class OfficeLinesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAgentDirectory() private readonly agents: AgentDirectory,
    ) {}

    /**
     * Posts one line. It speaks as the department's agent (Sales, Accounting, Chatbot) when that agent exists; without one,
     * and always for a command mirror, it stays a NIVO system line.
     */
    async post(ctx: WorkContext, line: OfficeLineInput): Promise<void> {
        const agent = await this.speaker(ctx, line)
        const [kind, name, agentId] =
            agent === null
                ? ["system", line.command === true ? COMMAND_LINE_AUTHOR : CORE_LINE_AUTHOR, null]
                : ["agent", agent.name, agent.id]
        await this.entityManager.query(INSERT_MESSAGE, [
            ctx.workspaceId,
            kind,
            name,
            agentId,
            line.body,
            line.lead_id,
            line.work_item_id,
        ])
    }

    private speaker(ctx: WorkContext, line: OfficeLineInput): Promise<OptionalAgentIdentity> {
        if (line.dept === undefined || line.command === true) return Promise.resolve(null)
        return this.agents.agentOfDepartment(ctx.workspaceId, line.dept, line.installation_id ?? null)
    }
}
