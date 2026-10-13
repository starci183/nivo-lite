import { Injectable } from "@nestjs/common"
import { keyOf } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { FACT_ANSWERS, KnowledgeGapsService, answers, keywordsOf } from "@modules/domain/knowledge-gaps"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentKnowledgeLogEvent } from "./agent-knowledge.log-events"
import type { GapNote, KnowledgeView } from "./agent-knowledge.contracts"
import { KnowledgeRecallService } from "./knowledge-recall.service"

/** How many facts and passages are compared with an unanswered question. */
const COVER_LIMIT = 5

@Injectable()
/**
 * Did a customer turn hit a knowledge gap? Two signals, both free of credits:
 *  1. the reply itself says so (`knowledge_gap` in the reply contract: the model knew it lacked the information);
 *  2. the reply asked for a person with no answer to propose AND nothing the view can read (a fact, or a passage found by words only,
 *     no embedding) covers the question's significant words.
 * A reply that asked for a person for another reason (an order, a payment claim, an application) is not a gap. Learning must never
 * break a customer's reply, so noting a gap never throws.
 */
export class KnowledgeGapNotesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly gaps: KnowledgeGapsService,
        private readonly recall: KnowledgeRecallService,
        private readonly search: KnowledgeSearchService,
    ) {}

    /** Records the gap of this turn when there is one. */
    async note(note: GapNote): Promise<void> {
        try {
            const { signals, view } = note
            const claimed = signals.knowledgeGap
            if (claimed !== null && claimed.question.trim() !== "") {
                await this.gaps.record(view.workspaceId, {
                    module: view.module,
                    question: claimed.question,
                    topic: claimed.topic,
                    conversationId: note.conversationId,
                    source: "model",
                })
                return
            }
            if (!signals.needsHuman || signals.proposedAnswer !== null || signals.isTransaction) return
            if (!(await this.isUncovered(view, note.question))) return
            await this.gaps.record(view.workspaceId, {
                module: view.module,
                question: note.question,
                conversationId: note.conversationId,
                source: "retrieval",
            })
        } catch (cause) {
            this.logger.error(AgentKnowledgeLogEvent.GapNoteFailed, cause, { conversationId: note.conversationId })
        }
    }

    /** True when nothing the view may read covers the question's words. */
    private async isUncovered(view: KnowledgeView, question: string): Promise<boolean> {
        const words = keywordsOf(question)
        if (words.length === 0) return false
        const [facts, passages] = await Promise.all([
            this.recall
                .factsMatching(view, question, COVER_LIMIT)
                .catch((cause: unknown) => this.skip(cause, view, [])),
            this.search
                .passagesText(view, words.join(" "), COVER_LIMIT)
                .catch((cause: unknown) => this.skip(cause, view, [])),
        ])
        const covered = (text: string): boolean => answers(words, new Set(keyOf(text).split("-")), FACT_ANSWERS)
        return (
            !facts.some((fact) => covered(`${fact.subjectLabel} ${fact.attributeLabel} ${fact.value}`)) &&
            !passages.some((passage) => covered(`${passage.title} ${passage.topic ?? ""} ${passage.content}`))
        )
    }

    private skip<T>(cause: unknown, view: KnowledgeView, fallback: T): T {
        this.logger.error(AgentKnowledgeLogEvent.RecallPartFailed, cause, {
            workspaceId: view.workspaceId,
            part: "coverage",
        })
        return fallback
    }
}
