import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { CUSTOMER_MESSAGE, InboundDoorService } from "@modules/domain/agent-inbound"
import { AgentWakeService, AgentWorkSettingsService } from "@modules/domain/agent-work"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import type { CustomerIntake, MessageIntake } from "./conversations.contracts"

@Injectable()
/**
 * Starts the answer to a stored customer message on the road the workspace is on (`road` in the agent work settings): `legacy` queues a
 * chat-turn job, `core` writes a customer wake. It runs in the caller's transaction, so the message and what answers it exist together or
 * not at all, and a message delivered twice starts one answer on either road. Only intake changes with the road; a job already queued
 * finishes on the queue it is on.
 */
export class CustomerIntakeService {
    constructor(
        private readonly settings: AgentWorkSettingsService,
        private readonly wakes: AgentWakeService,
        private readonly chatTurns: ChatTurnQueue,
        private readonly conversations: AgentConversationsService,
        private readonly door: InboundDoorService,
    ) {}

    /** Starts the answer to a message whose conversation and agent are known. */
    async answer(intake: CustomerIntake, manager: EntityManager): Promise<void> {
        if ((await this.settings.roadOf(intake.workspaceId)) === "core") await this.wake(intake, manager)
        else await this.queue(intake, manager)
    }

    /** Starts the answer to a message of a chat the caller has locked; the agent that speaks in it is read only on the core road, where the message goes through the inbound door. */
    async answerChat(intake: MessageIntake, manager: EntityManager): Promise<void> {
        if ((await this.settings.roadOf(intake.workspaceId)) !== "core") {
            await this.queue(intake, manager)
            return
        }
        const turn = await this.conversations.turnOf(intake.conversationId)
        if (turn.kind === "ok") await this.wakeThroughDoor({ ...intake, agentId: turn.value.agent.id }, manager)
        else await this.queue(intake, manager)
    }

    private async wake(intake: CustomerIntake, manager: EntityManager): Promise<void> {
        await this.wakes.wake(manager, {
            workspaceId: intake.workspaceId,
            agentId: intake.agentId,
            source: "customer",
            eventKey: intake.messageId,
            context: {
                conversationId: intake.conversationId,
                messageId: intake.messageId,
                channelEventId: intake.channelEventId,
                lookupName: intake.lookupName,
            },
            actorMemberId: null,
        })
    }

    /** The website chat: the message is an inbound event of the customer adapter, so the wake and its run are written by the one door. */
    private async wakeThroughDoor(intake: CustomerIntake, manager: EntityManager): Promise<void> {
        await this.door.accept(manager, {
            adapter: "customer",
            eventType: CUSTOMER_MESSAGE,
            actor: { kind: "customer", id: null, role: null },
            chain: null,
            payload: {
                conversationId: intake.conversationId,
                messageId: intake.messageId,
                channelEventId: intake.channelEventId,
                lookupName: intake.lookupName,
            },
            attachments: [],
            evidence: [],
            idempotencyKey: intake.messageId,
            workspaceId: intake.workspaceId,
            agentId: intake.agentId,
            scopeKey: null,
        })
    }

    private queue(intake: MessageIntake, manager: EntityManager): Promise<void> {
        return this.chatTurns.enqueueChatTurn(
            {
                kind: "turn",
                workspaceId: intake.workspaceId,
                conversationId: intake.conversationId,
                messageId: intake.messageId,
                channelEventId: intake.channelEventId,
                lookupName: intake.lookupName,
            },
            manager,
        )
    }
}
