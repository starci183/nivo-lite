import { Injectable, Optional } from "@nestjs/common"
import {
    buildIntentPrompt,
    IntentRegistryService,
    type InboundTrust,
    type IntentGap,
    type IntentInputPart,
    type IntentReading,
    type IntentTrace,
    type IntentTrigger,
} from "@modules/domain/intent-contracts"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import { InjectAgentGraphBrief, type AgentGraphBrief, type IntentNodeKeys } from "@modules/domain/agent-graphs"
import { InjectIntentFiles } from "./agent-turns.decorators"
import { AgentWriteRightService } from "./agent-write-right.service"
import { offeredOf, tagTrustOf, traceOf, triggerOf } from "./intent-turn.policy"
import type {
    IntentFileBundle,
    IntentFileRef,
    IntentPlan,
    IntentScope,
    IntentTurnPlan,
    OptionalIntentPlan,
} from "./agent-turns.contracts"
import type { IntentFiles } from "./agent-turns.port"

@Injectable()
/**
 * The contract pipeline of a turn, shared by the customer's message and a colleague's tag: which contracts the published version holds
 * for the trigger and the trust, the prompt built from them and the input, what the model's text came to, and the trace that is kept
 * on the turn. A turn the graph holds no contracts for (no graph, shadow, no active version, a reachable intent with no frame) gets no
 * plan, and the caller leaves it on the prompt it had before contracts. A pinned turn is offered the one contract it is pinned to and
 * can never split.
 */
export class IntentTurnService {
    constructor(
        private readonly registry: IntentRegistryService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly right: AgentWriteRightService,
        @Optional() @InjectAgentGraphBrief() private readonly graph: AgentGraphBrief | null = null,
        @Optional() @InjectIntentFiles() private readonly files: IntentFiles | null = null,
    ) {}

    /** The plan of the turn a wake starts: which contracts it is offered, or null when the turn stays on today's prompt. */
    async planFor(scope: IntentScope): Promise<OptionalIntentPlan> {
        const trigger = triggerOf(scope.source)
        if (this.graph === null || trigger === null) return null
        const trust = await this.trustOf(scope)
        const found = await this.graph.contractsOf(scope.workspaceId, scope.agentId, trigger, trust, scope.source)
        if (found === null) return null
        return {
            versionId: found.versionId,
            trigger,
            trust,
            pinned: scope.pinned,
            contracts: offeredOf(found, scope.pinned),
        }
    }

    /** The plan with the five-part prompt built from it: the identity is trusted, the input is data. */
    planOf(plan: IntentPlan, identity: string, input: ReadonlyArray<IntentInputPart>, locale: Locale): IntentTurnPlan {
        const prompt = buildIntentPrompt(
            {
                trigger: plan.trigger,
                trust: plan.trust,
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
        return this.registry.read(text, plan.contracts, plan.pinned)
    }

    /** The trace a turn leaves on its outcome. */
    traceOf(plan: IntentPlan, reading: IntentReading): IntentTrace {
        return traceOf(plan, reading)
    }

    /** True when the published version holds contracts for this trigger and trust: a write tool then needs a turn of its own. */
    async pipelineOf(scope: IntentScope): Promise<boolean> {
        return (await this.planFor(scope)) !== null
    }

    /** Raises the gap of a turn no intent fits as a proposal to the owner, deduped per agent on the question; false when it was already raised. */
    async raiseGap(gap: IntentGap): Promise<boolean> {
        return this.graph !== null && (await this.graph.raiseGap(gap))
    }

    /** The node keys of the active version the steps of a turn stand for; the trigger path's node alone when no graph is bound. */
    nodeKeysOf(
        workspaceId: string,
        agentId: string,
        trigger?: IntentTrigger,
        source?: string,
    ): Promise<IntentNodeKeys> {
        if (this.graph === null) return Promise.resolve({ turn: "understand", acts: {} })
        return trigger === undefined
            ? this.graph.nodeKeysOf(workspaceId, agentId)
            : this.graph.nodeKeysOf(workspaceId, agentId, trigger, source)
    }

    /** The files of a message, read for the turn; none when no chat files are bound. */
    filesOf(ref: IntentFileRef): Promise<IntentFileBundle> {
        return this.files === null ? Promise.resolve({ parts: [], attachments: [], money: null }) : this.files.of(ref)
    }

    private async trustOf(scope: IntentScope): Promise<InboundTrust> {
        if (scope.source !== "tag") return "outsider"
        return tagTrustOf(await this.right.mayWrite(scope.source, scope.authorUserId, scope.workspaceId))
    }
}
