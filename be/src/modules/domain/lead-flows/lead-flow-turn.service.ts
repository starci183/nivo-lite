import { Injectable } from "@nestjs/common"
import { AuthorityService } from "@modules/domain/authority"
import type { AgentProfile } from "@modules/domain/agents"
import { BrainFactsService, factLine } from "@modules/domain/brain-facts"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { WorkContext } from "@modules/domain/decisions"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectLeadTurnReader } from "./lead-flows.decorators"
import type { LeadTurnReader } from "./lead-flows.port"
import { clip } from "./lead-flow-identity.policy"
import { DEFAULT_CRITERIA, parseCriteria, parseQuestions, setupKindOf } from "./lead-flow-score.policy"
import type { SetupKind } from "./lead-flow-score.policy"
import { escalationFromText, flagsOf, parseAnalysis } from "./lead-flow-steps.policy"
import type { Analysis, EscalationReason, FlowSetup, SourceKind } from "./lead-flows.contracts"
import { LeadFlowsLogEvent } from "./lead-flows.log-events"

const MODULE = "lead_gen"
const FACT_LIMIT = 300

/** One turn to read. */
export interface TurnRequest {
    /** The lead_gen agent that speaks. */
    readonly agent: AgentProfile | null
    /** The turn key. */
    readonly turn: string
    /** The kind of touch. */
    readonly kind: SourceKind
    /** What the person wrote. */
    readonly text: string
    /** The person's name. */
    readonly name: string | null
    /** The question waiting for an answer. */
    readonly pendingQuestion: string | null
    /** The owner's criteria, in their words. */
    readonly criteriaText: string
    /** The first reply of a conversation: it greets, and may search with embeddings. */
    readonly first: boolean
}

/** What reading a turn gave: the analysis (null = the model failed), and the keyword escalation that skipped the model. */
export interface TurnReading {
    /** The analysis, or null when the model could not answer. */
    readonly analysis: Analysis | null
    /** The keyword escalation, when one settled the turn. */
    readonly keywordReason: EscalationReason | null
}

/** A question the knowledge could not answer, remembered for the owner. */
export interface TurnGapNote {
    /** The question. */
    readonly question: string
    /** subject | attribute. */
    readonly topic: string
    /** The conversation it came from. */
    readonly conversationId: string
}

@Injectable()
/**
 * The owner's setup of the lead flow (questions and criteria from the Second Brain) and the ONE model call of a turn. A keyword
 * escalation answers without the model; the score is never the model's.
 */
export class LeadFlowTurnService {
    constructor(
        private readonly facts: BrainFactsService,
        private readonly knowledge: KnowledgeSearchService,
        private readonly gaps: KnowledgeGapsService,
        private readonly authority: AuthorityService,
        @InjectLeadTurnReader() private readonly ai: LeadTurnReader,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The owner's qualification questions (at most four) and hot / warm / cold criteria, read as configuration. */
    async setup(workspaceId: string): Promise<FlowSetup> {
        const facts = await this.facts
            .forView(workspaceId, "internal", MODULE, null, FACT_LIMIT)
            .catch((cause: unknown) => {
                this.logger.error(LeadFlowsLogEvent.SetupUnreadable, cause, { workspaceId })
                return []
            })
        const first = (kind: SetupKind): string =>
            facts.find((fact) => setupKindOf(fact.attribute) === kind)?.value ?? ""
        const criteriaText = first("criteria")
        return {
            questions: parseQuestions(first("questions")),
            criteriaText,
            criteria: criteriaText === "" ? DEFAULT_CRITERIA : parseCriteria(criteriaText, first("icp")),
        }
    }

    /** Reads one turn: a keyword escalation without the model; otherwise one metered call against the public knowledge. */
    async read(ctx: WorkContext, request: TurnRequest): Promise<TurnReading> {
        const keywordReason = escalationFromText(request.text)
        if (keywordReason !== null) {
            const analysis = parseAnalysis(
                { flags: flagsOf(keywordReason), sentiment: "negative", confidence: 1 },
                request.turn,
            )
            return { analysis, keywordReason }
        }
        const authority = await this.authority.load({ workspaceId: ctx.workspaceId })
        const voice = [authority?.brand_voice ?? "", authority?.reply_style ?? ""]
            .filter((line) => line !== "")
            .join("\n")
        try {
            const raw = await this.ai.readLeadTurn(
                { workspaceId: ctx.workspaceId, locale: ctx.locale },
                {
                    agentName: request.agent?.name ?? null,
                    agentInstructions: request.agent?.instructions ?? "",
                    kind: request.kind,
                    text: request.text,
                    name: request.name,
                    pendingQuestion: request.pendingQuestion,
                    criteriaText: request.criteriaText,
                    first: request.first,
                    voice,
                    brief: await this.publicBrief(ctx.workspaceId, request.text, request.first),
                },
            )
            return { analysis: parseAnalysis(raw, request.turn), keywordReason: null }
        } catch (cause) {
            this.logger.error(LeadFlowsLogEvent.TurnUnread, cause, { workspaceId: ctx.workspaceId, turn: request.turn })
            return { analysis: null, keywordReason: null }
        }
    }

    /** Remembers a question the knowledge could not answer (the chatbot's learning loop). */
    async noteGap(workspaceId: string, gap: TurnGapNote): Promise<void> {
        await this.gaps
            .record(workspaceId, {
                module: MODULE,
                question: gap.question,
                topic: gap.topic,
                conversationId: gap.conversationId,
                source: "model",
            })
            .catch((cause: unknown) => {
                this.logger.error(LeadFlowsLogEvent.GapNotNoted, cause, { workspaceId })
            })
    }

    /**
     * The public knowledge for a prompt: confirmed facts and business passages. The first reply searches with the (metered) query embedding;
     * a later qualification turn uses words only, so it pays for exactly one thing: the model call.
     */
    private async publicBrief(workspaceId: string, query: string, embed: boolean): Promise<string> {
        const lens = { workspaceId, module: MODULE, audience: "customer" as const, installationId: null }
        const unreadable = (cause: unknown): [] => {
            this.logger.error(LeadFlowsLogEvent.KnowledgeUnreadable, cause, { workspaceId })
            return []
        }
        const [facts, passages] = await Promise.all([
            this.facts.search(workspaceId, "customer", MODULE, null, query, 5).catch(unreadable),
            (embed ? this.knowledge.passages(lens, query, 4) : this.knowledge.passagesText(lens, query, 4)).catch(
                unreadable,
            ),
        ])
        const factLines = facts.map((fact) => `- ${factLine(fact)}`)
        const passageLines = passages
            .filter((passage) => passage.visibility === "public")
            .map((passage) => `- ${passage.title}: ${clip(passage.content.replace(/\s+/g, " "), 400)}`)
        if (factLines.length === 0 && passageLines.length === 0) return ""
        return [
            "BUSINESS KNOWLEDGE (use only what is here; never invent a price, policy, date or promise that is not written):",
            factLines.length > 0 ? `Confirmed facts:\n${factLines.join("\n")}` : "",
            passageLines.length > 0 ? `From the business documents:\n${passageLines.join("\n")}` : "",
        ]
            .filter((line) => line !== "")
            .join("\n")
            .slice(0, 1800)
    }
}
