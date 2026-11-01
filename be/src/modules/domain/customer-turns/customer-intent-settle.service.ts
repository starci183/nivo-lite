import { Injectable } from "@nestjs/common"
import { IntentPipelineService, IntentTurnService, INTENT_STEP_KIND, pinnedOf } from "@modules/domain/agent-turns"
import type { AgentHandlerEnding, AgentTurnView } from "@modules/domain/agent-work"

@Injectable()
/**
 * The settle of a customer turn on the contract pipeline. The model's text is kept on the turn's run, read against the contracts the
 * turn was offered, and handed to the customer door with its trace. Whatever the reading came to, the door acts through a
 * `ChatTurnProposal` (or splits the turn), so the one outcome gate still decides what leaves. A turn the published graph holds no
 * contracts for gets null, and the caller settles it as it did before contracts.
 */
export class CustomerIntentSettleService {
    constructor(
        private readonly intents: IntentTurnService,
        private readonly pipeline: IntentPipelineService,
    ) {}

    /** The ending of the turn, or null when the turn is not on the pipeline. */
    async settle(turn: AgentTurnView, text: string, signal: AbortSignal): Promise<AgentHandlerEnding | null> {
        const plan = await this.intents.planFor({
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            source: "customer",
            authorUserId: null,
            pinned: pinnedOf(turn.context),
        })
        if (plan === null) return null
        const read = await this.pipeline.read(turn, plan, text, signal)
        const done = await this.pipeline.door(turn, INTENT_STEP_KIND.customerDoor, read, signal)
        return { status: "done", reason: null, outcome: { ...done, intent: read.trace } }
    }
}
