import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentWakeService } from "@modules/domain/agent-work"
import type { CustomerIntake } from "./conversations.contracts"
import { customerWakeContextOf } from "./customer-wake.policy"

@Injectable()
/**
 * Starts the answer to a stored customer message: it writes a customer wake for the agent that speaks in the conversation. It runs in the
 * caller's transaction, so the wake and the inbox row exist together or not at all, and a message delivered twice starts one answer (the
 * wake is keyed by the message).
 */
export class CustomerIntakeService {
    constructor(private readonly wakes: AgentWakeService) {}

    /** Starts the answer to a message whose conversation and agent are known. */
    async answer(intake: CustomerIntake, manager: EntityManager): Promise<void> {
        await this.wakes.wake(manager, {
            workspaceId: intake.workspaceId,
            agentId: intake.agentId,
            source: "customer",
            eventKey: intake.messageId,
            context: customerWakeContextOf(intake),
            actorMemberId: null,
        })
    }
}
