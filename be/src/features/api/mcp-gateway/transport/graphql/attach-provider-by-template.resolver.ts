import type { CommandBus } from "@nestjs/cqrs"
import { Args, ID, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AttachProviderByTemplateCommand } from "../../application/attach-provider-by-template.command"
import { AttachProviderByTemplateInput } from "./dto/attach-provider-by-template.input"

@Resolver()
/** GraphQL door of attachProviderByTemplate. */
export class AttachProviderByTemplateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Attaches the listed agents to a provider by their template; answers the agents attached. */
    @Mutation(() => [ID], { name: "attachProviderByTemplate" })
    async attachProviderByTemplate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AttachProviderByTemplateInput,
    ): Promise<Array<string>> {
        const result = await this.commandBus.execute(
            new AttachProviderByTemplateCommand({
                request: { workspaceId, connectionId: input.connectionId, agentIds: input.agentIds },
                principal,
            }),
        )
        return [...result]
    }
}
