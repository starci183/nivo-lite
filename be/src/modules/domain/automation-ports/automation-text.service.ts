import { Injectable } from "@nestjs/common"
import { DirectGenerationService, GenerationsService } from "@modules/domain/ai-generations"
import type { AutomationText, AutomationTextRequest, GeneratedText } from "@modules/domain/automations"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationPortsLogEvent } from "./automation-ports.log-events"

@Injectable()
/**
 * Writes automation text through the generation capability without failing an automation when the model cannot answer. The wording the
 * owner asks for while looking at the screen (`personalize`) is queued and waited for like every interactive text; the per-case and the
 * feedback texts are written by the automation tick, which is already a background job, so they run right there instead of waiting
 * on another job.
 */
export class AutomationTextService implements AutomationText {
    constructor(
        private readonly direct: DirectGenerationService,
        private readonly generations: GenerationsService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes one text, or answers none so the automation keeps its deterministic wording. */
    async generate(request: AutomationTextRequest): Promise<GeneratedText> {
        const purpose = `automation_${request.purpose}`
        try {
            const params = {
                workspaceId: request.workspaceId,
                purpose,
                kind: "engine",
                module: "other",
                timeoutMs: 40_000,
                responseFormat: "text",
                messages: [
                    { role: "system", content: request.system },
                    { role: "user", content: request.prompt },
                ],
            } as const
            const outcome =
                request.purpose === "personalize"
                    ? await this.generations.generate(params)
                    : await this.direct.run(params)
            return outcome.ok ? outcome.output.trim() || null : null
        } catch (cause) {
            this.logger.error(AutomationPortsLogEvent.TextGenerationFailed, cause, {
                workspaceId: request.workspaceId,
                purpose,
            })
            return null
        }
    }
}
