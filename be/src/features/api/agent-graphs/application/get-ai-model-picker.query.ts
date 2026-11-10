import { Query } from "@nestjs/cqrs"
import type { ModelPicker } from "@modules/domain/ai-tasks"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAiModelPickerRequest } from "./get-ai-model-picker.contracts"

/** The model picker of the node drawer: Auto and the explicit models, and what each AI node step declares. */
export class GetAiModelPickerQuery extends Query<ModelPicker> {
    constructor(readonly params: ExecuteParams<GetAiModelPickerRequest>) {
        super()
    }
}
