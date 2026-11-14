import { Injectable } from "@nestjs/common"
import { KnowledgeGapsService, type MaybeGapRecorded } from "@modules/domain/knowledge-gaps"
import { GapProposalsService } from "@modules/domain/public-documents"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentKnowledgeLogEvent } from "./agent-knowledge.log-events"
import type { GapNote } from "./agent-knowledge.contracts"

@Injectable()
/**
 * Did a customer turn hit a knowledge gap? Two signals, both free of credits:
 *  1. the reply itself says so (`knowledge_gap` in the reply contract: the model knew it lacked the information);
 *  2. the reply asked for a person with no answer to propose AND nothing the view can read (a fact, or a passage found by words only,
 *     no embedding) covers the question's significant words.
 * A reply that asked for a person for another reason (an order, a payment claim, an application) is not a gap. A new or reopened gap
 * also starts a background look, with no customer in it, for an answer in the internal documents: it only ever makes a proposal for
 * the owner. Learning must never break a customer's reply, so noting a gap never throws.
 */
export class KnowledgeGapNotesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly gaps: KnowledgeGapsService,
        private readonly proposals: GapProposalsService,
    ) {}

    /**
     * Records the gap of this turn when the MODEL of the turn claimed one (its own reading of the question against what it was
     * given: `signals.knowledgeGap`, with the topic it names). No gap is inferred by code from the words of a question any more
     * (owner 2026-11-12: no word list or word overlap decides what a text means).
     */
    async note(note: GapNote): Promise<void> {
        try {
            const { signals, view } = note
            const claimed = signals.knowledgeGap
            if (claimed === null || claimed.question.trim() === "") return
            await this.propose(
                view.workspaceId,
                await this.gaps.record(view.workspaceId, {
                    module: view.module,
                    question: claimed.question,
                    topic: claimed.topic,
                    conversationId: note.conversationId,
                    source: "model",
                }),
            )
        } catch (cause) {
            this.logger.error(AgentKnowledgeLogEvent.GapNoteFailed, cause, { conversationId: note.conversationId })
        }
    }

    /** A gap that is new, or asked again after it was answered, is looked up in the internal documents in the background. */
    private async propose(workspaceId: string, recorded: MaybeGapRecorded): Promise<void> {
        if (recorded === null || !(recorded.isNew || recorded.reopened)) return
        await this.proposals.open(workspaceId, recorded.gap)
    }
}
