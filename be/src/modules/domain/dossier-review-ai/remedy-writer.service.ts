import { Injectable } from "@nestjs/common"
import type { RemedyRequest, RemedyWriter } from "@modules/domain/dossier-review"
import { UsageMeterService } from "@modules/domain/knowledge"
import { InjectAi } from "@modules/integrations/ai"
import type { AiBudget, AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { OptionalRemedy } from "./dossier-review-ai.contracts"
import { ModelCallPolicy } from "./model-call.policy"
import { toRemedyText } from "./reasoned.mapper"
import { REMEDY_SCHEMA } from "./remedy.schema"
import { REMEDY_SYSTEM_PROMPT, remedyPrompt } from "./remedy-prompt.policy"

/** How long the model may take to write one document. */
const DRAFT_TIMEOUT_MS = 90_000

/** What one draft may spend: reasoning off and at most this many completion tokens (a body is at most 40,000 characters, about 14,000 tokens). */
const DRAFT_BUDGET: AiBudget = { effort: "off", maxTokens: 16_000 }

@Injectable()
/**
 * The dossier review's writer: drafts the document that would close a finding, with a placeholder for every value it was not given.
 * It answers null when the model is unavailable or its answer did not parse after the one retry; the core then marks the draft failed.
 */
export class RemedyWriterService extends ModelCallPolicy implements RemedyWriter {
    constructor(@InjectAi() ai: AiService, usage: UsageMeterService, @InjectLogger() logger: Logger) {
        super(ai, usage, logger)
    }

    /** One draft for a finding; the fixed tail is appended by the core, never asked of the model. */
    async draft(request: RemedyRequest): Promise<OptionalRemedy> {
        const call = await this.ask({
            workspaceId: request.workspaceId,
            system: REMEDY_SYSTEM_PROMPT,
            user: remedyPrompt(request),
            schema: REMEDY_SCHEMA,
            timeoutMs: DRAFT_TIMEOUT_MS,
            purpose: "remedy",
            budget: DRAFT_BUDGET,
        })
        return call === null ? null : toRemedyText(call.value, call.model)
    }
}
