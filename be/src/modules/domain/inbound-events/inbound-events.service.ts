import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { UnroutedMessage } from "./inbound-events.contracts"
import { INSERT_UNROUTED_EVENT } from "./persistence/inbound-events.sql"

@Injectable()
/** The inputs the workspace received, as the inbox page lists them; the only writer of inbound_events here. */
export class InboundEventsService {
    /** Keeps a message nobody is bound to answer visible in the inbox; the same event twice is one row. */
    async keepUnrouted(message: UnroutedMessage, manager: EntityManager): Promise<void> {
        await manager.query(INSERT_UNROUTED_EVENT, [
            message.workspaceId,
            message.channel,
            message.sender,
            message.body,
            message.eventId,
            `${message.channel}:message:${message.eventId}`,
        ])
    }
}
