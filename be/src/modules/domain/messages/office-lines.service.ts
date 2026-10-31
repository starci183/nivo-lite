import { Injectable } from "@nestjs/common"
import { IsNull, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { MessagesScope, OfficeLineInput, OptionalAgentIdentity } from "./office-lines.contracts"
import { InjectAgentDirectory } from "./office-lines.decorators"
import type { AgentDirectory } from "./office-lines.port"
import { MessageEntity } from "./persistence/entities"
import type { MessageAuthorKind } from "./persistence/entities"

/** The author name of a plain NIVO Core line. */
export const CORE_LINE_AUTHOR = "NIVO"
/** The author name of a command mirror line; the Office keeps it a system line, never re-attributed to an agent. */
export const COMMAND_LINE_AUTHOR = "NIVO Bus"

/** The name a line speaks under when no agent speaks it: the command mirror or the core system line. */
const systemAuthor = (line: OfficeLineInput): string => (line.command === true ? COMMAND_LINE_AUTHOR : CORE_LINE_AUTHOR)

@Injectable()
/** The Office thread: short lines linked to a work item, spoken by the department's own agent when it is installed. */
export class OfficeLinesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAgentDirectory() private readonly agents: AgentDirectory,
        private readonly activity: ChatActivityService,
    ) {}

    /**
     * Posts one line. It speaks as the department's agent (Sales, Accounting, Chatbot) when that agent exists; without one,
     * and always for a command mirror, it stays a NIVO system line.
     */
    async post(ctx: MessagesScope, line: OfficeLineInput, manager: EntityManager = this.entityManager): Promise<void> {
        const agent = await this.speaker(ctx, line)
        if (line.unlessSaidSince !== undefined && (await this.alreadySaid(ctx, line, line.unlessSaidSince, agent, manager))) {
            return
        }
        const kind: MessageAuthorKind = agent === null ? "system" : "agent"
        const name = agent === null ? systemAuthor(line) : agent.name
        await manager.insert(MessageEntity, {
            workspaceId: ctx.workspaceId,
            authorKind: kind,
            authorName: name,
            agentId: agent === null ? null : agent.id,
            body: line.body,
            leadId: line.lead_id,
            workItemId: line.work_item_id,
            ...(line.room === undefined ? {} : { room: line.room }),
        })
        await this.activity.message(
            ctx.workspaceId,
            chatActivityTarget({ room: line.room ?? null, conversationId: null }),
            null,
            manager,
        )
    }

    private alreadySaid(
        ctx: MessagesScope,
        line: OfficeLineInput,
        since: Date,
        agent: OptionalAgentIdentity,
        manager: EntityManager,
    ): Promise<boolean> {
        return manager.exists(MessageEntity, {
            where: {
                workspaceId: ctx.workspaceId,
                authorKind: agent === null ? "system" : "agent",
                agentId: agent === null ? IsNull() : agent.id,
                body: line.body,
                createdAt: MoreThanOrEqual(since),
            },
        })
    }

    private speaker(ctx: MessagesScope, line: OfficeLineInput): Promise<OptionalAgentIdentity> {
        if (line.agent_id !== undefined) return this.agents.agentById(ctx.workspaceId, line.agent_id)
        if (line.dept === undefined || line.command === true) return Promise.resolve(null)
        return this.agents.agentOfDepartment(ctx.workspaceId, line.dept, line.installation_id ?? null)
    }
}
