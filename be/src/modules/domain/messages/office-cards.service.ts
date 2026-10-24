import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MessagesError, MessagesErrorCode } from "./errors/messages.error"
import { MessagesLogEvent } from "./messages.log-events"
import type { DepartmentCardPost, OfficeCardPost, OptionalRoom } from "./office-cards.contracts"
import type { MessagesScope } from "./office-lines.contracts"
import { InjectAgentDirectory } from "./office-lines.decorators"
import type { AgentDirectory } from "./office-lines.port"
import { parseOfficeCard } from "./office-card.policy"
import { INSERT_CARD_MESSAGE } from "./persistence/office-lines.sql"
import { CORE_LINE_AUTHOR } from "./office-lines.service"

/** The stored card line: its id and the room it landed in. */
export interface PostedCard {
    /** The message id. */
    readonly id: string
    /** The room the line landed in; null is the general Office room. */
    readonly room: OptionalRoom
}

@Injectable()
/** Agent result cards in the Hub: one validated card line per call, spoken by the agent, in a room or routed by the database. */
export class OfficeCardsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAgentDirectory() private readonly agents: AgentDirectory,
        @InjectLogger() private readonly logger: Logger,
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
        const [row] = await this.entityManager.query<Array<PostedCard>>(INSERT_CARD_MESSAGE, [
            ctx.workspaceId,
            agent === null ? "system" : "agent",
            speaker.authorName,
            speaker.agentId,
            line.body.trim() === "" ? department : line.body.trim(),
            line.leadId,
            line.workItemId,
            line.room,
            null,
        ])
        return row ?? { id: "", room: line.room }
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
        const [row] = await manager.query<Array<PostedCard>>(INSERT_CARD_MESSAGE, [
            ctx.workspaceId,
            line.agentId === null ? "system" : "agent",
            line.authorName,
            line.agentId,
            body,
            line.leadId,
            line.workItemId,
            line.room,
            JSON.stringify(parsed.card),
        ])
        return row ?? { id: "", room: line.room }
    }
}
