import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { InboundStop, InboundStopReporter } from "@modules/domain/agent-inbound"
import { OfficeLinesService } from "./office-lines.service"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

/** The language of the line. */
const LOCALE = "vi"

/** A line said by this agent with these words since the beginning of time is not said again: a redelivered stop adds nothing. */
const EVER = new Date(0)

@Injectable()
/**
 * The Office half of a stopped chain of agents: when an event would wake an agent past the chain limit, or again without a new cause, the
 * agent says so in the main room, in the transaction of the delivery, so a stop is never silent and a stop that cannot be said rolls the
 * delivery back.
 */
export class OfficeInboundStopReporterService implements InboundStopReporter {
    constructor(
        private readonly lines: OfficeLinesService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Says the stop once in the main room as the agent that was not woken. */
    report(tx: EntityManager, stop: InboundStop): Promise<void> {
        const body = this.catalog.get(
            "agentInbound.chainStopped",
            { depth: stop.depth, reason: stop.reason, eventType: stop.eventType },
            LOCALE,
        )
        return this.lines.post(
            { workspaceId: stop.workspaceId },
            { body, lead_id: null, work_item_id: null, room: null, agent_id: stop.agentId, unlessSaidSince: EVER },
            tx,
        )
    }
}
