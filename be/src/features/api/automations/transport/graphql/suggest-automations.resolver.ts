import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SuggestAutomationsQuery } from "../../application/suggest-automations.query"
import { AutomationSuggestionType } from "./dto/automation-suggestion.type"
import { AutomationSuggestionsInput } from "./dto/automation-suggestions.input"
import { toAutomationSuggestionTypes, toSuggestAutomationsRequest } from "./suggest-automations.mapper"

@Resolver()
/** GraphQL door of the templates worth proposing for a module. */
export class SuggestAutomationsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the templates worth proposing for a module, or the workspace-wide ones. */
    @Query(() => [AutomationSuggestionType], { name: "automationSuggestions" })
    async automationSuggestions(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AutomationSuggestionsInput,
    ): Promise<Array<AutomationSuggestionType>> {
        const result = await this.queryBus.execute(
            new SuggestAutomationsQuery({ request: toSuggestAutomationsRequest(workspaceId, input), principal }),
        )
        return toAutomationSuggestionTypes(result)
    }
}
