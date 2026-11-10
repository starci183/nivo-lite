import { QueryHandler } from "@nestjs/cqrs"
import { InjectAiTasks } from "@modules/domain/ai-tasks"
import type { AiTasksService, ModelPicker } from "@modules/domain/ai-tasks"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAiModelPickerQuery } from "./get-ai-model-picker.query"

@QueryHandler(GetAiModelPickerQuery)
/**
 * The model picker of the node drawer: the same for every member of a workspace (it names no record of it), so the workspace guard of
 * the resolver is the only check. Which explicit models are available follows the keys of this deployment.
 */
export class GetAiModelPickerHandler extends ICQRSHandler<GetAiModelPickerQuery, ModelPicker> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectAiTasks() private readonly ai: AiTasksService,
    ) {
        super(logger)
    }

    protected override process(query: GetAiModelPickerQuery): Promise<ModelPicker> {
        return Promise.resolve(this.ai.modelPicker(query.params.request.locale === "en" ? "en" : "vi"))
    }
}
