import { Injectable } from "@nestjs/common"
import type { DossierBundle, DossierReasoner } from "@modules/domain/dossier-review"
import { UsageMeterService } from "@modules/domain/knowledge"
import { InjectAi } from "@modules/integrations/ai"
import type { AiBudget, AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SYSTEM_PROMPT, userPrompt } from "./dossier-review-prompt.policy"
import { DOSSIER_REVIEW_SCHEMA } from "./dossier-review.schema"
import type { OptionalReview } from "./dossier-review-ai.contracts"
import { ModelCallPolicy } from "./model-call.policy"
import { toReasonedReview } from "./reasoned.mapper"

/** How long the model may take to review one dossier: with reasoning off it answers in about five seconds. */
const REVIEW_TIMEOUT_MS = 60_000

/** What one review may spend: reasoning off (the default reasoning writes about 10,000 tokens and takes about a minute) and at most this many completion tokens (eight findings are about 3,000). */
const REVIEW_BUDGET: AiBudget = { effort: "off", maxTokens: 8000 }

@Injectable()
/**
 * The dossier review's model: reads one bundle critically and answers the findings it cites and its verdict on the AI findings still open.
 * It answers null when the model is unavailable or its answer did not parse after the one retry; the core then keeps the rule findings.
 */
export class DossierReasonerService extends ModelCallPolicy implements DossierReasoner {
    constructor(@InjectAi() ai: AiService, usage: UsageMeterService, @InjectLogger() logger: Logger) {
        super(ai, usage, logger)
    }

    /** One review of a bundle; the answer is not yet checked against the bundle, the core's evidence guard does that. */
    async review(bundle: DossierBundle): Promise<OptionalReview> {
        const call = await this.ask({
            workspaceId: bundle.workspaceId,
            system: SYSTEM_PROMPT,
            user: userPrompt(bundle),
            schema: DOSSIER_REVIEW_SCHEMA,
            timeoutMs: REVIEW_TIMEOUT_MS,
            purpose: "review",
            budget: REVIEW_BUDGET,
        })
        return call === null ? null : toReasonedReview(call.value, call)
    }
}
