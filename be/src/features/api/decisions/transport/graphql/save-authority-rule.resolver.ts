import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveRuleCommand } from "../../application/save-rule.command"
import { AuthorityRuleType } from "./dto/authority-rule.type"
import { SaveAuthorityRuleInput } from "./dto/save-authority-rule.input"
import { toAuthorityRuleType, toSaveRuleRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door that saves the rule of one action. */
export class SaveAuthorityRuleResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the rule of one action. */
    @Mutation(() => AuthorityRuleType, { name: "saveAuthorityRule" })
    async saveAuthorityRule(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveAuthorityRuleInput,
    ): Promise<AuthorityRuleType> {
        const result = await this.commandBus.execute(
            new SaveRuleCommand({ request: toSaveRuleRequest(workspaceId, input), principal }),
        )
        return toAuthorityRuleType(result)
    }
}
