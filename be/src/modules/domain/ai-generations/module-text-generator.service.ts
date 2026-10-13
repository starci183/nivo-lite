import { Injectable } from "@nestjs/common"
import { ModuleTextGenerator } from "@modules/domain/module-ops"
import type { ModuleTextRequest, TextResult } from "@modules/domain/module-ops"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import { GenerationsService } from "./generations.service"

/** The usage kind a business module's text is metered under: an engine step, like the other work texts. */
const MODULE_TEXT_KIND = "engine"

/** The answer when no text was written. */
const NO_TEXT: TextResult = { ok: false, output: "" }

@Injectable()
/**
 * The text generator of the business modules (hiring, shifts, inventory): one generation through the single door, gated by the
 * workspace quota, metered under the request's purpose and module and cancelled past the request's timeout. It never throws.
 */
export class ModuleTextGeneratorService extends ModuleTextGenerator {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly generations: GenerationsService,
    ) {
        super()
    }

    /** Writes one text; a refusal, a timeout or a model failure answers `ok: false`. */
    override async generate(request: ModuleTextRequest): Promise<TextResult> {
        try {
            const outcome = await this.generations.generate({
                workspaceId: request.workspaceId,
                purpose: request.purpose,
                messages: [
                    { role: "system", content: request.system },
                    { role: "user", content: request.user },
                ],
                responseFormat: "text",
                timeoutMs: request.timeoutMs,
                kind: MODULE_TEXT_KIND,
                module: request.module,
            })
            return outcome.ok ? { ok: true, output: outcome.output } : NO_TEXT
        } catch (cause) {
            this.logger.error(AiGenerationsLogEvent.GenerationFailed, cause, { purpose: request.purpose })
            return NO_TEXT
        }
    }
}
