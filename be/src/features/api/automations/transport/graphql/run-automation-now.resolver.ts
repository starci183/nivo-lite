import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RunNowCommand } from "../../application/run-now.command"
import { TemplateKeyInput } from "./dto/template-key.input"
import { toTemplateRequest } from "./template-key.mapper"

@Resolver()
/** GraphQL door of one run now of a scheduled template. */
export class RunAutomationNowResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs a scheduled n8n template once now; answers true once the run is queued. */
    @Mutation(() => Boolean, { name: "runAutomationNow" })
    async runAutomationNow(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TemplateKeyInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new RunNowCommand({ request: toTemplateRequest(workspaceId, input), principal }))
        return true
    }
}
