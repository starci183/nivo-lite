import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { ChatActivityService, chatActivityTarget } from "@modules/domain/chat-activity"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MessagesError, MessagesErrorCode } from "./errors/messages.error"
import { MessagesLogEvent } from "./messages.log-events"
import type { DepartmentCardPost, OfficeCardPost, OptionalRoom, PostedCard } from "./office-cards.contracts"
import type { MessagesScope } from "./office-lines.contracts"
import { InjectAgentDirectory } from "./office-lines.decorators"
import type { AgentDirectory } from "./office-lines.port"
import { parseOfficeCard } from "./office-card.policy"
import { postedCardOf } from "./posted-rows.policy"
import { MessageEntity } from "./persistence/entities"
import { CORE_LINE_AUTHOR } from "./office-lines.service"

@Injectable()
/** Agent result cards in the Hub: one validated card line per call, spoken by the agent, in a room or routed by the database. */
export class OfficeCardsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAgentDirectory() private readonly agents: AgentDirectory,
        @InjectLogger() private readonly logger: Logger,
        private readonly activity: ChatActivityService,
    ) {}

    /**
     * Posts a card spoken by the department's agent (the NIVO system line when the department has none). A payload the contract
     * refuses still reaches the room as its preview line, so an agent's flow never fails on its card; the refusal and its reason are
     * logged so a broken card producer is visible.
     */
    async postAsDepartment(ctx: MessagesScope, department: string, line: DepartmentCardPost): Promise<PostedCard> {
        const agent = await this.agents.agentOfDepartment(ctx.workspaceId, department, null)
        const speaker = {
            agentId: agent === null ? null : agent.id,
            authorName: agent === null ? CORE_LINE_AUTHOR : agent.name,
        }
        const parsed = parseOfficeCard(line.card)
        if (parsed.ok) return this.post(ctx, { ...line, ...speaker })
        this.logger.warn(MessagesLogEvent.CardRefused, {
            workspaceId: ctx.workspaceId,
            department,
            reason: parsed.reason,
        })
        const row = await this.store(this.entityManager, {
            workspaceId: ctx.workspaceId,
            authorKind: agent === null ? "system" : "agent",
            authorName: speaker.authorName,
            agentId: speaker.agentId,
            body: line.body.trim() === "" ? department : line.body.trim(),
            leadId: line.leadId,
            workItemId: line.workItemId,
            room: line.room,
            card: null,
        })
        return this.announced(ctx.workspaceId, row, line.room, this.entityManager)
    }

    /** Validates the payload against the card contract and stores the line; a broken payload is refused with its reason. */
    async post(
        ctx: MessagesScope,
        line: OfficeCardPost,
        manager: EntityManager = this.entityManager,
    ): Promise<PostedCard> {
        const parsed = parseOfficeCard(line.card)
        if (!parsed.ok)
            throw new MessagesError({ code: MessagesErrorCode.CardInvalid, params: { reason: parsed.reason } })
        const body = line.body.trim() === "" ? parsed.card.title : line.body.trim()
        const row = await this.store(manager, {
            workspaceId: ctx.workspaceId,
            authorKind: line.agentId === null ? "system" : "agent",
            authorName: line.authorName,
            agentId: line.agentId,
            body,
            leadId: line.leadId,
            workItemId: line.workItemId,
            room: line.room,
            card: parsed.card,
        })
        return this.announced(ctx.workspaceId, row, line.room, manager)
    }

    /** Stores one card line and answers its id and the room the database routed it to. */
    private async store(
        manager: EntityManager,
        values: QueryDeepPartialEntity<MessageEntity>,
    ): Promise<PostedCard | undefined> {
        const result = await manager
            .createQueryBuilder(MessageEntity, "m")
            .insert()
            .values(values)
            .returning("id, room")
            .execute()
        return postedCardOf(result.raw)
    }

    private async announced(
        workspaceId: string,
        row: PostedCard | undefined,
        room: OptionalRoom,
        manager: EntityManager,
    ): Promise<PostedCard> {
        const posted = row ?? { id: "", room }
        await this.activity.message(
            workspaceId,
            chatActivityTarget({ room: posted.room, conversationId: null }),
            null,
            manager,
        )
        return posted
    }
}
