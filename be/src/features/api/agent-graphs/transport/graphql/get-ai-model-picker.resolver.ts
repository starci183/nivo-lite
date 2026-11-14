import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetAiModelPickerQuery } from "../../application/get-ai-model-picker.query"
import { AiModelPickerType } from "./dto/ai-model-picker.type"
import { GetAiModelPickerInput } from "./dto/get-ai-model-picker.input"

@Resolver()
/** GraphQL door of aiModelPicker. */
export class GetAiModelPickerResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The aiModelPicker query: the node drawer's model picker. */
    @Query(() => AiModelPickerType, { name: "aiModelPicker" })
    aiModelPicker(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetAiModelPickerInput,
    ): Promise<AiModelPickerType> {
        return this.queryBus.execute(new GetAiModelPickerQuery({ request: { workspaceId, locale: input.locale }, principal }))
    }
}
