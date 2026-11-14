import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { ForkFirstPartyTemplateCommand } from "../../application/fork-first-party-template.command"
import { TemplateVersionType } from "./dto/template-version.type"
import { ForkFirstPartyTemplateInput } from "./dto/fork-first-party-template.input"
import { toForkFirstPartyTemplateRequest, toForkFirstPartyTemplateType } from "./fork-first-party-template.mapper"

@Resolver()
/** GraphQL door of forkFirstPartyTemplate. */
export class ForkFirstPartyTemplateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts a template of the caller from a first-party package, keeping the provenance of its branches. */
    @Mutation(() => TemplateVersionType, { name: "forkFirstPartyTemplate" })
    async forkFirstPartyTemplate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ForkFirstPartyTemplateInput,
    ): Promise<TemplateVersionType> {
        const result = await this.commandBus.execute(
            new ForkFirstPartyTemplateCommand({
                request: toForkFirstPartyTemplateRequest(workspaceId, input),
                principal,
            }),
        )
        return toForkFirstPartyTemplateType(result)
    }
}
