import { Injectable } from "@nestjs/common"
import { BrainFactRelationsService, BrainFactsReadService } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { InjectAi } from "@modules/integrations/ai"
import type { AiBudget, AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { ModelJsonService } from "./model-json.service"
import { RELATIONS_PROMPT, RELATION_FACTS_MAX, parseRelations, relationsPrompt } from "./relation-extraction.policy"

/** How long the model may take to link the facts of one document. */
const RELATIONS_TIMEOUT_MS = 40_000

/** What linking may spend: no reasoning, a short JSON answer. */
const RELATIONS_BUDGET: AiBudget = { effort: "off", maxTokens: 3000 }

@Injectable()
/**
 * The edges of the truth graph out of one document, as a second, cheap pass over the facts the reading filed (the facts are read once
 * per document; the relation pass reads only their one-line form, never the document again). It runs when a reading filed new facts,
 * so its cost follows the change. A failure is logged and never stops the reading: the facts stand without edges.
 */
export class DocumentRelationsService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly reads: BrainFactsReadService,
        private readonly relations: BrainFactRelationsService,
        private readonly usage: UsageMeterService,
        private readonly json: ModelJsonService,
    ) {}

    /** Links the waiting and active facts of one document; answers how many edges were asked for. */
    async link(source: SourceRecord): Promise<number> {
        const workspaceId = source.workspaceId
        try {
            const facts = await this.reads.ofSources(workspaceId, [source.id], ["proposed", "active"], RELATION_FACTS_MAX)
            if (facts.length < 2 || (await this.usage.blockedBy(workspaceId, "brain", false))) return 0
            const prompt = relationsPrompt(facts)
            const answer = await this.ai.chat({
                messages: [
                    { role: "system", content: RELATIONS_PROMPT },
                    { role: "user", content: prompt },
                ],
                json: false,
                schema: null,
                timeoutMs: RELATIONS_TIMEOUT_MS,
                budget: RELATIONS_BUDGET,
                context: null,
            })
            if (answer === null) return 0
            await this.usage.record({
                workspaceId,
                kind: "brain",
                module: "knowledge",
                model: answer.model,
                usage: answer.usage,
                promptChars: RELATIONS_PROMPT.length + prompt.length,
                completionChars: answer.text.length,
            })
            const edges = parseRelations(this.json.jsonOf(answer.text), facts) ?? []
            return await this.relations.linkMany(workspaceId, edges)
        } catch (cause) {
            this.logger.error(BrainLogEvent.RelationsFailed, cause, { sourceId: source.id })
            return 0
        }
    }
}
