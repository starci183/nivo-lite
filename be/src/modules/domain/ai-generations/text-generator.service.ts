import { Injectable } from "@nestjs/common"
import type { DeepseekTextGenerator, TextRequest } from "@modules/integrations/deepseek"
import { GenerationsService } from "./generations.service"

@Injectable()
/** The text door the prompt library generates through: every prompt becomes a generation row that OpenClaw runs. */
export class TextGeneratorService implements DeepseekTextGenerator {
    constructor(private readonly generations: GenerationsService) {}

    /** Writes the text of a prompt, or fails with the sentence to show when the model cannot answer. */
    generate(request: TextRequest): Promise<string> {
        return this.generations.text({
            workspaceId: request.workspaceId,
            purpose: request.purpose,
            messages: request.messages,
            responseFormat: request.json ? "json" : "text",
            kind: request.kind,
            module: request.module,
        })
    }
}
