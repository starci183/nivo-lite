import { Injectable } from "@nestjs/common"
import type { CritiqueBundle, CritiqueTry, DocumentCriticModel } from "@modules/domain/dossier-review"
import { UsageMeterService } from "@modules/domain/knowledge"
import { CRITIC_EFFORT, InjectAi, type AiBudget, type AiService } from "@modules/integrations/ai"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DOCUMENT_CRITIQUE_OUTPUT_SCHEMA, readCritique } from "./document-critic-answer.policy"
import { CRITIC_POINTS_MAX, CRITIC_SYSTEM_PROMPT, criticUserPrompt } from "./document-critic-prompt.policy"
import { DOCUMENT_CRITIQUE_SCHEMA } from "./document-critic.schema"
import { ModelCallPolicy } from "./model-call.policy"

/** How long one critique of a shop document may take: the cheap chat profile with reasoning off answers a slice in seconds. */
const CRITIQUE_TIMEOUT_MS = 90_000

/** The completion tokens one point of a critique answer is sized at: a short line, why and question, and one quote of 300 characters. */
const CRITIQUE_POINT_TOKENS = 200

/**
 * What one critique may spend: reasoning off (it only looks for text addressed to an AI, a reading, not a judgement) and a cap
 * sized from the answer's shape, the most points the prompt allows. An answer that still reaches the cap is told by its finish
 * reason and asked again over half the passages (`DocumentCriticService`), never parsed.
 */
const CRITIQUE_BUDGET: AiBudget = { effort: CRITIC_EFFORT, maxTokens: CRITIC_POINTS_MAX * CRITIQUE_POINT_TOKENS }

@Injectable()
/** The critic's model: reads one shop document critically and answers the points it cites, one call per try the critic counts. */
export class DossierReasonerService extends ModelCallPolicy implements DocumentCriticModel {
    constructor(@InjectAi() ai: AiService, usage: UsageMeterService, @InjectLogger() logger: Logger) {
        super(ai, usage, logger)
    }

    /**
     * ONE critique call of a shop document (the critic counts its three tries), on the endpoint's chat profile (no target: the cheap
     * tier); recorded under kind `brain`, module `dossier_review`.
     * The answer is asked as the API's structured output and read point by point: a point that does not fit is left out and
     * reported in `refused`, the others stand. `attempt` is the try the critic counts (absent: 2 after an unreadable answer, else 1).
     */
    async critique(bundle: CritiqueBundle, after?: "unreadable", attempt?: number): Promise<CritiqueTry> {
        const call = await this.askOnce(
            {
                workspaceId: bundle.workspaceId,
                system: CRITIC_SYSTEM_PROMPT,
                user: criticUserPrompt(bundle, after),
                schema: DOCUMENT_CRITIQUE_SCHEMA,
                outputSchema: DOCUMENT_CRITIQUE_OUTPUT_SCHEMA,
                timeoutMs: CRITIQUE_TIMEOUT_MS,
                purpose: "critique",
                budget: CRITIQUE_BUDGET,
                cached: true,
            },
            attempt ?? (after === "unreadable" ? 2 : 1),
        )
        if (call === "unavailable" || call === "unreadable" || call === "cut") return { ok: false, reason: call }
        const read = readCritique(call.value)
        return {
            ok: true,
            answer: {
                findings: read.findings,
                model: call.model,
                promptTokens: call.promptTokens,
                completionTokens: call.completionTokens,
                ...(read.refused.length === 0 ? {} : { refused: read.refused }),
            },
        }
    }
}
