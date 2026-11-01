import { Injectable, Optional } from "@nestjs/common"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { buildIntentPrompt, readIntentResult } from "@modules/domain/intent-contracts"
import type {
    IntentAudience,
    IntentGap,
    IntentInputPart,
    IntentReading,
    IntentTrace,
} from "@modules/domain/intent-contracts"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectAgentGraphBrief } from "./agent-turns.decorators"
import { AgentWriteRightService } from "./agent-write-right.service"
import { offeredOf, tagAudienceOf, traceOf, triggerOf } from "./intent-turn.policy"
import type { IntentPlan, IntentScope, IntentTurnPlan, OptionalIntentPlan } from "./agent-turns.contracts"
import type { AgentGraphBrief } from "./agent-turns.port"

@Injectable()
/**
 * The contract pipeline of a turn, shared by the customer's message and a colleague's tag: which contracts the published version holds
 * for the trigger and the audience, the prompt built from them and the input, what the model's text came to, and the trace that is kept
 * on the turn. A turn the graph holds no contracts for (no graph, shadow, no active version, a reachable intent with no frame) gets no
 * plan, and the caller leaves it on the prompt it had before contracts. A pinned turn is offered the one contract it is pinned to and
 * can never split.
 */
export class IntentTurnService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly right: AgentWriteRightService,
        private readonly gaps: KnowledgeGapsService,
        @Optional() @InjectAgentGraphBrief() private readonly graph: AgentGraphBrief | null = null,
    ) {}

    /** The plan of the turn a wake starts: which contracts it is offered, or null when the turn stays on today's prompt. */
    async planFor(scope: IntentScope): Promise<OptionalIntentPlan> {
        const trigger = triggerOf(scope.source)
        if (this.graph === null || trigger === null) return null
        const audience = await this.audienceOf(scope)
        const found = await this.graph.contractsOf(scope.workspaceId, scope.agentId, trigger, audience)
        if (found === null) return null
        return {
            versionId: found.versionId,
            trigger,
            audience,
            pinned: scope.pinned,
            contracts: offeredOf(found, scope.pinned),
        }
    }

    /** The plan with the five-part prompt built from it: the identity is trusted, the input is data. */
    planOf(plan: IntentPlan, identity: string, input: ReadonlyArray<IntentInputPart>, locale: Locale): IntentTurnPlan {
        const prompt = buildIntentPrompt(
            {
                trigger: plan.trigger,
                audience: plan.audience,
                identity,
                input,
                contracts: plan.contracts,
                pinned: plan.pinned,
            },
            (key, params) => this.catalog.get(key, params ?? {}, locale),
        )
        return { ...plan, prompt }
    }

    /** What the model's text came to: a pinned turn never splits, the reading of a pinned turn allows no other intent. */
    readingOf(text: string, plan: IntentPlan): IntentReading {
        return readIntentResult(text, plan.contracts, plan.pinned)
    }

    /** The trace a turn leaves on its outcome. */
    traceOf(plan: IntentPlan, reading: IntentReading): IntentTrace {
        return traceOf(plan, reading)
    }

    /** True when the published version holds contracts for this trigger and audience: a write tool then needs a turn of its own. */
    async pipelineOf(scope: IntentScope): Promise<boolean> {
        return (await this.planFor(scope)) !== null
    }

    /** Raises the gap of a turn no intent fits as an open question of the module; the same question counts again on the same gap. */
    async raiseGap(gap: IntentGap, module: string): Promise<void> {
        await this.gaps.record(gap.workspaceId, {
            module,
            question: gap.question,
            topic: gap.topic,
            source: "model",
        })
    }

    private async audienceOf(scope: IntentScope): Promise<IntentAudience> {
        if (scope.source !== "tag") return "customer"
        return tagAudienceOf(await this.right.mayWrite(scope.source, scope.authorUserId, scope.workspaceId))
    }
}
