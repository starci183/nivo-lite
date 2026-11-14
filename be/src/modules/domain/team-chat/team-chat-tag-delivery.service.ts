import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isTeamChatTagPayload } from "@modules/queues/team-chat-tag"
import { TEAM_CHAT_MESSAGE_TRIGGER } from "./team-chat-message.trigger"

@Injectable()
/**
 * THE TEAM CHAT'S ENTRY to the one event pipeline (concept triggers rule 13), run by the api only (the one app that drives runs; R24): a
 * queued tag (written by whichever app the message was posted in, keyed by message and agent) is translated by the team chat's pure
 * declaration and handed to the ONE delivery function for the tagged agent, the member beside the event. NOT provided by the team chat
 * module: only the api's job module composes it, so the mcp app composes no delivery.
 */
export class TeamChatTagDeliveryService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly triggers: ProviderTriggersService,
    ) {}

    /** Delivers the tag a job names; a payload that is no tag (only this capability writes the job) ends the job doing nothing. */
    async deliverJob(payload: object): Promise<void> {
        if (!isTeamChatTagPayload(payload)) return
        const event = TEAM_CHAT_MESSAGE_TRIGGER.translate(
            {
                roomId: payload.roomId,
                messageId: payload.messageId,
                text: payload.text,
                agentId: payload.agentId,
                actorMemberId: payload.memberId,
            },
            { connectionId: null },
        )
        if (event === null) return
        await this.entityManager.transaction((tx) =>
            this.triggers.deliver(
                {
                    workspaceId: payload.workspaceId,
                    declaration: TEAM_CHAT_MESSAGE_TRIGGER,
                    connectionId: null,
                    agentId: payload.agentId,
                    events: [{ event, actorMemberId: payload.memberId }],
                },
                tx,
            ),
        )
    }
}
