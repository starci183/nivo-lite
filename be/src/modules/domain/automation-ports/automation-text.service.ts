import { Injectable } from "@nestjs/common"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import type { AutomationText, AutomationTextRequest, GeneratedText } from "@modules/domain/automations"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationPortsLogEvent } from "./automation-ports.log-events"

@Injectable()
/** Writes automation text through the generation capability without failing an automation when the model cannot answer. */
export class AutomationTextService implements AutomationText {
    constructor(
        private readonly generations: DirectGenerationService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes one text, or answers none so the automation keeps its deterministic wording. */
    async generate(request: AutomationTextRequest): Promise<GeneratedText> {
        const purpose = `automation_${request.purpose}`
        try {
            const outcome = await this.generations.run({
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
            })
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
