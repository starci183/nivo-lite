import { Injectable } from "@nestjs/common"
import { AiTasksService, type ModelPicker } from "@modules/domain/ai-tasks"
import type { OptionalText } from "./agent-pages.contracts"

@Injectable()
/**
 * The model picker of the node drawer: the same for every member of a workspace (it names no record of it). Which explicit models are
 * available follows the keys of this deployment.
 */
export class AgentModelPickerService {
    constructor(private readonly ai: AiTasksService) {}

    /** The picker in the language a request names: English only when `en` is named, Vietnamese for any other (or none). */
    picker(locale: OptionalText): Promise<ModelPicker> {
        return Promise.resolve(this.ai.modelPicker(locale === "en" ? "en" : "vi"))
    }
}
