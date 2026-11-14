import { chainStoppedKind, type ChainStoppedPayload } from "@nivo-lite/agent-sdk/team-chat"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import type { ChainStop } from "./team-chat-notice.contracts"
import { TeamChatAudienceService } from "./team-chat-audience.service"
import { lineClientIdOf } from "./team-chat.policy"

/** The language of the line. */
const LOCALE = "vi"

/** The kind of the line of a stopped chain. */
export const CHAIN_STOPPED_MESSAGE_KIND: typeof chainStoppedKind.id = chainStoppedKind.id

@Injectable()
/**
 * Tells the founder, in the direct room of the agent that was not woken, that a chain of agents stopped at its limit: the agent says so
 * in /chat, so a stop is never silent. A stop the chat cannot post throws, so the delivery rolls back and the sender retries; the line's
 * key is the agent, the depth, the reason and the event type, so a redelivered stop adds no second line. The agent is the founder's to
 * hear, never a group's: no right to post is needed.
 */
export class TeamChatChainStopReporterService {
    constructor(
        private readonly audience: TeamChatAudienceService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Says the stop once, as the agent that was not woken. The door's transaction is not used: the line is keyed, so a retry repeats nothing. */
    async report(_tx: EntityManager, stop: ChainStop): Promise<void> {
        const summary = this.catalog.get(
            "teamChat.chainStopped",
            { depth: stop.depth, reason: stop.reason, eventType: stop.eventType },
            LOCALE,
        )
        const payload: ChainStoppedPayload = { version: 1, depth: stop.depth, reason: stop.reason, eventType: stop.eventType }
        await this.audience.postTeamCard(stop.workspaceId, {
            agentId: stop.agentId,
            audience: "founder",
            key: lineClientIdOf(`chain-stopped:${stop.agentId}:${String(stop.depth)}:${stop.reason}:${stop.eventType}`),
            message: {
                kind: CHAIN_STOPPED_MESSAGE_KIND,
                intent: "notify",
                title: CHAIN_STOPPED_MESSAGE_KIND,
                summary,
                payload,
                options: [],
            },
        })
    }
}
